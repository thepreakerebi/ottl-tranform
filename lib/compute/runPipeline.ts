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
      // traces
      const t1 = applyAddAttribute(current, b.config as unknown as AddAttrConfig);
      // logs
      const t2 = applyAddAttributeLogs(t1, b.config as unknown as AddAttrConfig);
      // metrics
      const t3 = applyAddAttributeMetrics(t2, b.config as unknown as AddAttrConfig);
      current = t3;
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

// Logs model (minimal)
type LogRecord = AttributeContainer & {
  timeUnixNano?: string;
  severityText?: string;
  severityNumber?: number;
  body?: Record<string, unknown> | string;
};
type ScopeLogs = { scope?: Scope; logRecords?: LogRecord[] };
type ResourceLogs = { resource?: Resource; scopeLogs?: ScopeLogs[] };
type LogsDoc = { resourceLogs?: ResourceLogs[] };

// Metrics model (minimal)
type DataPoint = AttributeContainer & { timeUnixNano?: string; value?: number | string };
type Metric = {
  name?: string;
  description?: string;
  unit?: string;
  sum?: { dataPoints?: DataPoint[] };
  gauge?: { dataPoints?: DataPoint[] };
  histogram?: { dataPoints?: DataPoint[] };
};
type ScopeMetrics = { scope?: Scope; metrics?: Metric[] };
type ResourceMetrics = { resource?: Resource; scopeMetrics?: ScopeMetrics[] };
type MetricsDoc = { resourceMetrics?: ResourceMetrics[] };

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
        // Decide write targets dynamically for Conditional
        if (cfg.scope === "conditional") {
          const targets = detectWriteTargets(cfg.condition, sp, ss.scope as Scope | undefined);
          if (targets.toScope) upsertAttr(ss.scope as unknown as AttributeContainer | undefined, cfg, resourceAttrs);
          if (targets.toSpan) upsertAttr(sp, cfg, resourceAttrs);
          if (!targets.toScope && !targets.toSpan) upsertAttr(sp, cfg, resourceAttrs);
        } else {
          upsertAttr(sp, cfg, resourceAttrs);
        }
      }
    }
  }
  return t as unknown as JSONValue;
}

// Apply for logs (resource + log records)
function applyAddAttributeLogs(telemetry: JSONValue, cfg: AddAttrConfig): JSONValue {
  if (!isObj(telemetry)) return telemetry;
  const doc = telemetry as unknown as LogsDoc;
  if (!Array.isArray(doc.resourceLogs)) return telemetry;
  const t: LogsDoc = clone(doc);
  for (const rl of t.resourceLogs ?? []) {
    const resourceAttrs = arrayToMap(rl.resource?.attributes);
    if (cfg.scope === "resource") {
      const hasMatch = !cfg.condition || (rl.scopeLogs ?? []).some((sl) => (sl.logRecords ?? []).some((lr) => evaluateChainLogs(cfg.condition, lr, sl.scope, resourceAttrs)));
      if (hasMatch) upsertAttr(rl.resource, cfg, resourceAttrs);
      continue;
    }
    // allLogs / conditional
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of sl.logRecords ?? []) {
        const ok = !cfg.condition || evaluateChainLogs(cfg.condition, lr, sl.scope, resourceAttrs);
        if (!ok) continue;
        upsertAttr(lr, cfg, resourceAttrs);
      }
    }
  }
  return t as unknown as JSONValue;
}

function applyAddAttributeMetrics(telemetry: JSONValue, cfg: AddAttrConfig): JSONValue {
  if (!isObj(telemetry)) return telemetry;
  const doc = telemetry as unknown as MetricsDoc;
  if (!Array.isArray(doc.resourceMetrics)) return telemetry;
  const t: MetricsDoc = clone(doc);
  for (const rm of t.resourceMetrics ?? []) {
    const resourceAttrs = arrayToMap(rm.resource?.attributes);
    if (cfg.scope === "resource") {
      const hasMatch = !cfg.condition || (rm.scopeMetrics ?? []).some((sm) =>
        (sm.metrics ?? []).some((m) => datapointsOf(m).some((dp) => evaluateChainMetrics(cfg.condition, dp, m, sm.scope, resourceAttrs)))
      );
      if (hasMatch) upsertAttr(rm.resource, cfg, resourceAttrs);
      continue;
    }
    for (const sm of rm.scopeMetrics ?? []) {
      for (const m of sm.metrics ?? []) {
        for (const dp of datapointsOf(m)) {
          const ok = !cfg.condition || evaluateChainMetrics(cfg.condition, dp, m, sm.scope, resourceAttrs);
          if (!ok) continue;
          upsertAttr(dp, cfg, resourceAttrs);
        }
      }
    }
  }
  return t as unknown as JSONValue;
}

function datapointsOf(m: Metric): DataPoint[] {
  if (m.sum?.dataPoints) return m.sum.dataPoints;
  if (m.gauge?.dataPoints) return m.gauge.dataPoints;
  if (m.histogram?.dataPoints) return m.histogram.dataPoints;
  return [];
}

function evaluateChainMetrics(chain: AddAttrConfig["condition"], dp: DataPoint, metric: Metric, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  if (!chain) return true;
  const first = evaluateCmpMetric(chain.first, dp, metric, scope, resourceAttrs);
  return chain.rest.reduce((acc, clause) => {
    const rhs = evaluateCmpMetric(clause.expr, dp, metric, scope, resourceAttrs);
    return clause.op === "AND" ? (acc && rhs) : (acc || rhs);
  }, first);
}

function evaluateCmpMetric(cmp: NonNullable<AddAttrConfig["condition"]>["first"], dp: DataPoint, metric: Metric, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  const left = resolveMetric(dp, metric, scope, cmp.attribute, resourceAttrs);
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

function resolveMetric(dp: DataPoint, metric: Metric, scope: Scope | undefined, field: string, resourceAttrs?: Record<string, JSONValue>): JSONValue | undefined {
  const f = (field || "").trim();
  if (!f) return undefined;
  // Metric-level explicit prefix
  if (f.startsWith("metric.")) {
    const p = f.slice("metric.".length);
    const mrec = metric as unknown as Record<string, unknown>;
    if (p in mrec) return mrec[p] as JSONValue;
    return undefined;
  }
  if (f.startsWith("resource.")) {
    const p = f.slice("resource.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m && resourceAttrs) return resourceAttrs[m[1]];
    }
    return getByPath((dp as unknown as { resource?: Record<string, unknown> })?.resource as Record<string, unknown> | undefined, p);
  }
  if (f.startsWith("scope.")) {
    const p = f.slice("scope.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m) return findAttr(scope?.attributes, m[1]);
    }
    return getByPath(scope as unknown as Record<string, unknown> | undefined, p);
  }
  if (f.startsWith("datapoint.")) {
    const p = f.slice("datapoint.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m) return findAttr(dp.attributes, m[1]);
    }
    return getByPath(dp as unknown as Record<string, unknown>, p);
  }
  // common aliases
  if (f === "name") return (metric.name as unknown) as JSONValue;
  if (f === "description") return (metric.description as unknown) as JSONValue;
  if (f === "unit") return (metric.unit as unknown) as JSONValue;
  if (f === "value") return (dp.value as unknown) as JSONValue;
  const fromAttr = findAttr(dp.attributes, f);
  if (fromAttr !== undefined) return fromAttr;
  if (resourceAttrs && f in resourceAttrs) return resourceAttrs[f];
  return getByPath(dp as unknown as Record<string, unknown>, f);
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

// Logs chain/eval
function evaluateChainLogs(chain: AddAttrConfig["condition"], item: LogRecord, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  if (!chain) return true;
  const first = evaluateCmpLog(chain.first, item, scope, resourceAttrs);
  return chain.rest.reduce((acc, clause) => {
    const rhs = evaluateCmpLog(clause.expr, item, scope, resourceAttrs);
    return clause.op === "AND" ? (acc && rhs) : (acc || rhs);
  }, first);
}

function evaluateCmpLog(cmp: NonNullable<AddAttrConfig["condition"]>["first"], item: LogRecord, scope: Scope | undefined, resourceAttrs?: Record<string, JSONValue>): boolean {
  const left = resolveLog(item, scope, cmp.attribute, resourceAttrs);
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

function resolveLog(item: LogRecord, scope: Scope | undefined, field: string, resourceAttrs?: Record<string, JSONValue>): JSONValue | undefined {
  const f = (field || "").trim();
  if (!f) return undefined;
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
  if (f.startsWith("log.")) {
    const p = f.slice("log.".length);
    if (p.startsWith("attributes[")) {
      const m = p.match(/^attributes\["([^"]+)"\]$/);
      if (m) return findAttr(item.attributes, m[1]);
    }
    return getByPath(item as unknown as Record<string, unknown>, p);
  }
  if (f === "severityText") return item.severityText as unknown as JSONValue;
  if (f === "severityNumber") return item.severityNumber as unknown as JSONValue;
  if (f === "body") {
    if (typeof item.body === "string") return item.body as unknown as JSONValue;
    if (item.body && typeof item.body === "object") {
      const k = Object.keys(item.body)[0];
      return (item.body as Record<string, unknown>)[k] as JSONValue;
    }
  }
  const fromLogAttr = findAttr(item.attributes, f);
  if (fromLogAttr !== undefined) return fromLogAttr;
  if (resourceAttrs && f in resourceAttrs) return resourceAttrs[f];
  return getByPath(item as unknown as Record<string, unknown>, f);
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

// (helper reserved for future routing across signals)

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

function detectWriteTargets(chain: AddAttrConfig["condition"] | null | undefined, span: Span, scope: Scope | undefined) {
  // Heuristic: if any clause explicitly references scope.name equality or prefix-less name equals scope.name, write to scope
  const toScope = !!(mentionsScopeNameEquality(chain, scope) || mentionsExplicitScopeNameLiteral(chain, scope));
  // Heuristic: if any clause explicitly references span.* fields (spanId/traceId/name) or prefix-less name equals span.name, write to span
  let toSpan = false;
  if (chain) {
    const checks = [chain.first, ...chain.rest.map((c) => c.expr)];
    toSpan = checks.some((c) => {
      if (c.attribute === "spanId" || c.attribute === "traceId" || c.attribute === "parentSpanId" || c.attribute === "kind") return true;
      if (c.attribute === "name" && String(span?.name ?? "") === String(c.value ?? "")) return true;
      if (c.attribute.startsWith("span.")) return true;
      return false;
    });
  }
  return { toScope, toSpan };
}


