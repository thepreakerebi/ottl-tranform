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
type Scope = AttributeContainer & { name?: string; version?: string; droppedAttributesCount?: number };
type ScopeSpans = { scope?: Scope; spans?: Span[] };
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
    if (cfg.scope === "resource") {
      const hasMatch = !cfg.condition || (rs.scopeSpans ?? []).some((ss) => (ss.spans ?? []).some((sp) => evaluateChain(cfg.condition, sp, ss.scope as Scope | undefined, resourceAttrs)));
      if (hasMatch) upsertAttr(rs.resource, cfg, resourceAttrs);
      continue;
    }
    for (const ss of rs.scopeSpans ?? []) {
      for (const sp of ss.spans ?? []) {
        const isRoot = !sp.parentSpanId;
        const within = cfg.scope === "allSpans" || (cfg.scope === "rootSpans" && isRoot) || cfg.scope === "conditional";
        if (!within) continue;
        const condOk = !cfg.condition || evaluateChain(cfg.condition, sp, ss.scope as Scope | undefined, resourceAttrs);
        if (!condOk) continue;
        // If conditional and the chain clearly targets scope.name (e.g., name == <literal matching scope.name> or scope.name == <literal>), write to scope
        const writeToScope = cfg.scope === "conditional" && (mentionsScopeNameEquality(cfg.condition, ss.scope as Scope | undefined) || mentionsExplicitScopeNameLiteral(cfg.condition, ss.scope as Scope | undefined));
        if (writeToScope) {
          upsertAttr(ss.scope as unknown as AttributeContainer | undefined, cfg, resourceAttrs);
        } else {
          upsertAttr(sp, cfg, resourceAttrs);
        }
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
  const key = cfg.sourceAttr ?? "";
  // Try span/resource attributes first
  let source: JSONValue | undefined;
  if (Array.isArray((item as AttributeContainer).attributes)) {
    source = findAttr((item as AttributeContainer).attributes as AttributeKV[] | undefined, key);
  }
  if (source === undefined && resourceAttrs) {
    source = resourceAttrs[key];
  }
  const src = String(source ?? "");
  const start = parseInt(cfg.substringStart ?? "0", 10) || 0;
  const end = cfg.substringEnd ? parseInt(cfg.substringEnd, 10) : undefined;
  return typeof end === "number" ? src.substring(start, end) : src.substring(start);
}

function coerceLiteral(type: AddAttrConfig["literalType"], raw: string): JSONValue {
  if (type === "number") return Number(raw);
  if (type === "boolean") return raw === "true";
  return raw;
}

function evaluateChain(chain: AddAttrConfig["condition"], item: Span, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  if (!chain) return true;
  const first = evaluateCmp(chain.first, item, scope, resourceAttrs);
  return chain.rest.reduce((acc, clause) => {
    const rhs = evaluateCmp(clause.expr, item, scope, resourceAttrs);
    return clause.op === "AND" ? (acc && rhs) : (acc || rhs);
  }, first);
}

function evaluateCmp(cmp: NonNullable<AddAttrConfig["condition"]>["first"], item: Span, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  // Special multi-source handling for plain "name"
  if (cmp.attribute === "name") {
    const candidates: Array<JSONValue | undefined> = [
      item?.name as unknown as JSONValue | undefined,
      (scope?.name as unknown as JSONValue | undefined),
      resourceAttrs ? (resourceAttrs["service.name"] as JSONValue | undefined) : undefined,
    ];
    switch (cmp.operator) {
      case "exists":
        return candidates.some((v) => v !== undefined && v !== null && String(v).length > 0);
      case "eq":
        return candidates.some((v) => String(v) === String(cmp.value ?? ""));
      case "neq":
        return candidates.every((v) => String(v) !== String(cmp.value ?? ""));
      case "contains":
        return candidates.some((v) => String(v).includes(String(cmp.value ?? "")));
      case "starts":
        return candidates.some((v) => String(v).startsWith(String(cmp.value ?? "")));
      case "regex":
        try { return candidates.some((v) => new RegExp(String(cmp.value ?? "")).test(String(v))); } catch { return false; }
    }
  }
  const left = resolveField(item, scope, cmp.attribute, resourceAttrs);
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

function resolveField(item: Span, scope: Scope | undefined, field: string, resourceAttrs?: Record<string, JSONValue>): JSONValue | undefined {
  const f = (field || "").trim();
  if (!f) return undefined;
  // Explicit prefixes
  if (f.startsWith("resource.")) {
    const p = f.slice("resource.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m && resourceAttrs) return resourceAttrs[m[1]];
    }
    return getByPath((item as unknown as { resource?: Record<string, unknown> })?.resource as Record<string, unknown> | undefined, p);
  }
  if (f.startsWith("scope.")) {
    const p = f.slice("scope.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m) return findAttr(scope?.attributes, m[1]);
    }
    return getByPath(scope as unknown as Record<string, unknown> | undefined, p);
  }
  if (f.startsWith("span.")) {
    const p = f.slice("span.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m) return findAttr(item.attributes, m[1]);
    }
    return getByPath(item as unknown as Record<string, unknown>, p);
  }

  // Friendly aliases (span core) with fallbacks to scope/resource where sensible
  if (f === "name") {
    const spanName = item?.name as unknown as JSONValue | undefined;
    if (spanName !== undefined && String(spanName).length > 0) return spanName;
    const scopeName = scope?.name as unknown as JSONValue | undefined;
    if (scopeName !== undefined && String(scopeName).length > 0) return scopeName;
    if (resourceAttrs && resourceAttrs["service.name"] !== undefined) return resourceAttrs["service.name"];
  }
  if (f === "kind") return item?.kind as unknown as JSONValue;
  if (f === "spanId") return (item as unknown as { spanId?: string }).spanId;
  if (f === "traceId") return (item as unknown as { traceId?: string }).traceId;
  if (f === "parentSpanId") return (item as unknown as { parentSpanId?: string }).parentSpanId;
  if (f === "droppedEventsCount") {
    const v = (item as unknown as { droppedEventsCount?: number }).droppedEventsCount;
    return (v ?? (scope?.droppedAttributesCount as unknown)) as JSONValue | undefined;
  }
  if (f === "droppedLinksCount") {
    const v = (item as unknown as { droppedLinksCount?: number }).droppedLinksCount;
    return v as unknown as JSONValue | undefined;
  }
  if (f === "droppedAttributesCount") {
    const v = (item as unknown as { droppedAttributesCount?: number }).droppedAttributesCount;
    const s = scope?.droppedAttributesCount as unknown as JSONValue | undefined;
    return (v as unknown as JSONValue) ?? s;
  }

  // Attributes - try span then resource
  const fromSpan = findAttr(item.attributes, f);
  if (fromSpan !== undefined) return fromSpan;
  if (resourceAttrs && f in resourceAttrs) return resourceAttrs[f];

  // scope fallbacks
  if (scope) {
    const fromScopeAttr = findAttr(scope.attributes, f);
    if (fromScopeAttr !== undefined) return fromScopeAttr;
    const fromScope = getByPath(scope as unknown as Record<string, unknown>, f);
    if (fromScope !== undefined) return fromScope as JSONValue;
  }

  // Deep path on span
  const deep = getByPath(item as unknown as Record<string, unknown>, f);
  if (deep !== undefined) return deep as JSONValue;

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

function getByPath(obj: Record<string, unknown> | undefined, path: string): JSONValue | undefined {
  if (!obj) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      // if array, take first matching element (best-effort)
      cur = (cur as unknown[])[0];
    }
    if (typeof cur === "object" && cur !== null) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur as JSONValue | undefined;
}

function mentionsScopeNameEquality(chain: AddAttrConfig["condition"] | null | undefined, scope: Scope | undefined): boolean {
  if (!chain || !scope) return false;
  const checks = [chain.first, ...chain.rest.map((c) => c.expr)];
  return checks.some((c) => c.attribute === "name" && c.operator === "eq" && String(c.value ?? "") === String(scope.name ?? ""));
}

function mentionsExplicitScopeNameLiteral(chain: AddAttrConfig["condition"] | null | undefined, scope: Scope | undefined): boolean {
  if (!chain || !scope) return false;
  const checks = [chain.first, ...chain.rest.map((c) => c.expr)];
  return checks.some((c) => c.attribute === "scope.name" && c.operator === "eq" && String(c.value ?? "") === String(scope.name ?? ""));
}


