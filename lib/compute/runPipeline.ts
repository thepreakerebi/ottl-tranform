import type { Block, JSONValue } from "../ottl/types";

type AddAttrConfig = {
  key: string;
  scope: "resource" | "allSpans" | "rootSpans" | "allLogs" | "allDatapoints" | "conditional";
  mode: "literal" | "substring";
  literalType?: "string" | "number" | "boolean";
  literalValue?: string;
  sourceAttr?: string;
  substringStart?: string;
  substringEnd?: string;
  collision?: "upsert" | "skip" | "onlyIfMissing";
  condition?: {
    first: { kind: "cmp"; attribute: string; operator: "eq" | "neq" | "contains" | "starts" | "regex" | "exists"; value?: JSONValue };
    rest: Array<{ op: "AND" | "OR"; expr: { kind: "cmp"; attribute: string; operator: "eq" | "neq" | "contains" | "starts" | "regex" | "exists"; value?: JSONValue }}>;
  } | null;
};

export type RunResult = {
  snapshots: Array<{ stepIndex: number; before: JSONValue | null; after: JSONValue | null }>;
};

export function runPipeline(telemetry: JSONValue, blocks: Block[]): RunResult {
  let current: JSONValue = clone(telemetry);
  const snapshots: RunResult["snapshots"] = [];

  blocks.forEach((b, idx) => {
    const before = clone(current);
    if (!b.enabled) {
      snapshots.push({ stepIndex: idx, before, after: before });
      return;
    }
    if (b.type === "addAttribute") {
      current = applyAddAttribute(current, b.config as unknown as AddAttrConfig);
    }
    snapshots.push({ stepIndex: idx, before, after: clone(current) });
  });

  return { snapshots };
}

// Minimal OTLP JSON trace model types used for safe traversal
type AttributeKV = { key: string; value: Record<string, unknown> };
type AttributeContainer = { attributes?: AttributeKV[] };
type Span = AttributeContainer & { name?: string; kind?: number | string; parentSpanId?: string };
type ScopeSpans = { spans?: Span[] };
type Resource = AttributeContainer;
type ResourceSpans = { resource?: Resource; scopeSpans?: ScopeSpans[] };
type TracesDoc = { resourceSpans?: ResourceSpans[] };

function applyAddAttribute(telemetry: JSONValue, cfg: AddAttrConfig): JSONValue {
  if (!isObj(telemetry)) return telemetry;
  if (!isTracesDoc(telemetry)) return telemetry;
  const t: TracesDoc = clone(telemetry);
  const resourceSpans = t.resourceSpans ?? [];
  for (const rs of resourceSpans) {
    const resourceAttrs = arrayToMap(rs.resource?.attributes);
    const rsMatch = (span: Span) => evaluateChain(cfg.condition, span, resourceAttrs);
    if (cfg.scope === "resource") {
      const hasMatch = !cfg.condition || (rs.scopeSpans ?? []).some((ss) => (ss.spans ?? []).some((sp) => rsMatch(sp)));
      if (hasMatch) upsertAttr(rs.resource, cfg, resourceAttrs);
      continue;
    }
    for (const ss of rs.scopeSpans ?? []) {
      for (const sp of ss.spans ?? []) {
        const isRoot = !sp.parentSpanId;
        const within = cfg.scope === "allSpans" || (cfg.scope === "rootSpans" && isRoot) || cfg.scope === "conditional";
        if (!within) continue;
        if (!cfg.condition || rsMatch(sp)) upsertAttr(sp, cfg, resourceAttrs);
      }
    }
  }
  return t as unknown as JSONValue;
}

function upsertAttr(target: AttributeContainer | undefined, cfg: AddAttrConfig, resourceAttrs?: Record<string, JSONValue>) {
  if (!target) return;
  const nextValue = String(resolveValue(cfg, target, resourceAttrs));
  const pair: AttributeKV = { key: cfg.key, value: { stringValue: nextValue } };
  const list: AttributeKV[] = Array.isArray(target.attributes) ? target.attributes : [];
  const idx = list.findIndex((a) => a.key === cfg.key);
  if (idx >= 0) {
    if (cfg.collision === "upsert") list[idx] = pair;
  } else {
    list.push(pair);
  }
  target.attributes = list;
}

function resolveValue(cfg: AddAttrConfig, item: AttributeContainer, resourceAttrs?: Record<string, JSONValue>) {
  if (cfg.mode === "literal") return coerceLiteral(cfg.literalType, cfg.literalValue ?? "");
  // substring
  const src = String(resolveField(item, cfg.sourceAttr ?? "", resourceAttrs) ?? "");
  const start = parseInt(cfg.substringStart ?? "0", 10) || 0;
  const end = cfg.substringEnd ? parseInt(cfg.substringEnd, 10) : undefined;
  return typeof end === "number" ? src.substring(start, end) : src.substring(start);
}

function coerceLiteral(type: AddAttrConfig["literalType"], raw: string): JSONValue {
  if (type === "number") return Number(raw);
  if (type === "boolean") return raw === "true";
  return raw;
}

function evaluateChain(chain: AddAttrConfig["condition"], item: Span, resourceAttrs?: Record<string, JSONValue>): boolean {
  if (!chain) return true;
  const first = evaluateCmp(chain.first, item, resourceAttrs);
  return chain.rest.reduce((acc, clause) => {
    const rhs = evaluateCmp(clause.expr, item, resourceAttrs);
    return clause.op === "AND" ? (acc && rhs) : (acc || rhs);
  }, first);
}

function evaluateCmp(cmp: NonNullable<AddAttrConfig["condition"]>["first"], item: Span, resourceAttrs?: Record<string, JSONValue>): boolean {
  const left = resolveField(item, cmp.attribute, resourceAttrs);
  switch (cmp.operator) {
    case "exists":
      return left !== undefined && left !== null && String(left).length > 0;
    case "eq":
      return String(left) === String(cmp.value ?? "");
    case "neq":
      return String(left) !== String(cmp.value ?? "");
    case "contains":
      return String(left).includes(String(cmp.value ?? ""));
    case "starts":
      return String(left).startsWith(String(cmp.value ?? ""));
    case "regex":
      try { return new RegExp(String(cmp.value ?? "")).test(String(left)); } catch { return false; }
  }
}

function resolveField(item: Span, field: string, resourceAttrs?: Record<string, JSONValue>): JSONValue | undefined {
  const f = (field || "").trim();
  if (!f) return undefined;
  // Friendly aliases for traces
  if (f === "name") return item?.name;
  if (f === "kind") return item?.kind;
  // attribute lookup with dotted keys in span.attributes or resource.attributes
  const fromSpan = findAttr(item.attributes, f);
  if (fromSpan !== undefined) return fromSpan;
  if (resourceAttrs && (f in resourceAttrs)) return resourceAttrs[f];
  return undefined;
}

function findAttr(attrs: AttributeKV[] | undefined, key: string): JSONValue | undefined {
  if (!Array.isArray(attrs)) return undefined;
  const found = attrs.find((a) => a.key === key);
  if (!found) return undefined;
  const v = found.value;
  if (!v || typeof v !== "object") return undefined;
  const k = Object.keys(v)[0];
  return (v as Record<string, unknown>)[k] as JSONValue;
}

function arrayToMap(attrs: AttributeKV[] | undefined): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {};
  if (!Array.isArray(attrs)) return out;
  for (const a of attrs) {
    const v = a.value as Record<string, unknown> | undefined;
    if (v && typeof v === "object") {
      const k = Object.keys(v)[0];
      out[a.key] = v[k] as JSONValue;
    }
  }
  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function isTracesDoc(v: unknown): v is TracesDoc {
  return isObj(v) && Array.isArray((v as Record<string, unknown>).resourceSpans);
}


