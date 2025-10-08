import type { Block, JSONValue, ConditionChain, ConditionOperator } from "./types";

type Buckets = {
  trace: string[];
  metric: string[];
  log: string[];
};

export function compileBlocksToOTTL(blocks: Block[]): string {
  const buckets: Buckets = { trace: [], metric: [], log: [] };

  for (const b of blocks) {
    if (!b.enabled) continue;
    switch (b.type) {
      case "addAttribute":
        compileAddAttribute(b, buckets);
        break;
      case "removeAttribute":
        compileRemoveAttribute(b, buckets);
        break;
      case "maskAttribute":
        compileMaskAttribute(b, buckets);
        break;
      default:
        // unsupported in MVP
        break;
    }
  }

  const out: string[] = ["transform:"]; // processor name omitted; this is body

  if (buckets.trace.length) {
    out.push("  trace_statements:");
    for (const s of buckets.trace) out.push(`    - ${s}`);
  }
  if (buckets.metric.length) {
    out.push("  metric_statements:");
    for (const s of buckets.metric) out.push(`    - ${s}`);
  }
  if (buckets.log.length) {
    out.push("  log_statements:");
    for (const s of buckets.log) out.push(`    - ${s}`);
  }

  return out.join("\n");
}

function compileAddAttribute(block: Block, buckets: Buckets) {
  const cfg = block.config as Record<string, unknown>;
  const key = String(cfg.key ?? "");
  const scope = String(cfg.scope ?? "allSpans");
  const mode = String(cfg.mode ?? "literal");
  const literalType = String(cfg.literalType ?? "string");
  const literalValue = String(cfg.literalValue ?? "");
  const sourceAttr = String(cfg.sourceAttr ?? "");
  const substringStart = String(cfg.substringStart ?? "0");
  const substringEnd = cfg.substringEnd == null || String(cfg.substringEnd).length === 0 ? undefined : String(cfg.substringEnd);
  const chain = cfg.condition as ConditionChain | null | undefined;

  const where = chain ? ` where ${compileWhere(chain)}` : "";

  if (scope === "resource") {
    const val = compileValue(mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, true);
    buckets.trace.push(`context: resource\n      statements:\n        - set(resource.attributes["${key}"], ${val})`);
    return;
  }

  if (scope === "allDatapoints") {
    const val = compileValue(mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, false);
    buckets.metric.push(`context: datapoint\n      statements:\n        - set(attributes["${key}"], ${val})`);
    return;
  }

  if (scope === "allLogs") {
    const val = compileValue(mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, false);
    buckets.log.push(`context: log\n      statements:\n        - set(attributes["${key}"], ${val})${where}`);
    return;
  }

  // spans (allSpans | rootSpans | conditional)
  const val = compileValue(mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, false);
  const rootClause = scope === "rootSpans" ? appendWhere(where, "IsRootSpan()") : where;
  buckets.trace.push(`context: span\n      statements:\n        - set(attributes["${key}"], ${val})${rootClause}`);
}

function compileRemoveAttribute(block: Block, buckets: Buckets) {
  const cfg = block.config as Record<string, unknown>;
  const scope = String(cfg.scope ?? "allSpans");
  type RemoveCfg = { keys?: string[]; condition?: ConditionChain | null };
  const rc = cfg as RemoveCfg;
  const keys: string[] = Array.isArray(rc.keys) ? rc.keys as string[] : [];
  const chain = cfg["condition"] as ConditionChain | null | undefined;
  const where = chain ? ` where ${compileWhere(chain)}` : "";

  if (scope === "resource") {
    // Emit resource context under trace bucket (mirrors addAttribute)
    if (keys.length === 0) return;
    const lines = keys.map((k) => `- delete_key(resource.attributes, ${JSON.stringify(k)})`).join("\n        ");
    buckets.trace.push(`context: resource\n      statements:\n        ${lines}`);
    return;
  }

  if (scope === "allDatapoints") {
    if (keys.length === 0) return;
    const lines = keys.map((k) => `- delete_key(attributes, ${JSON.stringify(k)})`).join("\n        ");
    buckets.metric.push(`context: datapoint\n      statements:\n        ${lines}`);
    return;
  }

  if (scope === "allLogs") {
    if (keys.length === 0) return;
    const lines = keys.map((k) => `- delete_key(attributes, ${JSON.stringify(k)})${where}`).join("\n        ");
    buckets.log.push(`context: log\n      statements:\n        ${lines}`);
    return;
  }

  // spans (allSpans | rootSpans | conditional)
  if (keys.length === 0) return;
  const rootClause = scope === "rootSpans" ? appendWhere(where, "IsRootSpan()") : where;
  const lines = keys.map((k) => `- delete_key(attributes, ${JSON.stringify(k)})${rootClause}`).join("\n        ");
  buckets.trace.push(`context: span\n      statements:\n        ${lines}`);
}

function compileMaskAttribute(block: Block, buckets: Buckets) {
  const cfg = block.config as Record<string, unknown>;
  const scope = String(cfg.scope ?? "allSpans");
  const keys: string[] = Array.isArray((cfg as { keys?: string[] }).keys) ? (cfg as { keys?: string[] }).keys || [] : [];
  const start = String(cfg["substringStart"] ?? "0");
  const endRaw = cfg["substringEnd"];
  const end = endRaw == null || String(endRaw).length === 0 ? undefined : String(endRaw);
  const chain = cfg["condition"] as ConditionChain | null | undefined;
  const where = chain ? ` where ${compileWhere(chain)}` : "";

  if (keys.length === 0) return;

  if (scope === "resource") {
    const lines = keys.map((k) => `- set(resource.attributes[${JSON.stringify(k)}], ${compileMaskExpr(true, k, start, end)})`).join("\n        ");
    buckets.trace.push(`context: resource\n      statements:\n        ${lines}`);
    return;
  }

  if (scope === "allDatapoints") {
    const lines = keys.map((k) => `- set(attributes[${JSON.stringify(k)}], ${compileMaskExpr(false, k, start, end)})`).join("\n        ");
    buckets.metric.push(`context: datapoint\n      statements:\n        ${lines}`);
    return;
  }

  if (scope === "allLogs") {
    const lines = keys.map((k) => `- set(attributes[${JSON.stringify(k)}], ${compileMaskExpr(false, k, start, end)})${where}`).join("\n        ");
    buckets.log.push(`context: log\n      statements:\n        ${lines}`);
    return;
  }

  const rootClause = scope === "rootSpans" ? appendWhere(where, "IsRootSpan()") : where;
  const lines = keys.map((k) => `- set(attributes[${JSON.stringify(k)}], ${compileMaskExpr(false, k, start, end)})${rootClause}`).join("\n        ");
  buckets.trace.push(`context: span\n      statements:\n        ${lines}`);
}

function compileMaskExpr(isResource: boolean, key: string, start: string, end: string | undefined): string {
  const src = isResource ? `resource.attributes[${JSON.stringify(key)}]` : `attributes[${JSON.stringify(key)}]`;
  const s = Number(start) || 0;
  const left = `Substring(${src}, 0, ${s})`;
  if (end == null) {
    return `Concat(${left}, "*")`;
  }
  const e = Number(end);
  const right = `Substring(${src}, ${isNaN(e) ? s : e})`;
  return `Concat(${left}, "*", ${right})`;
}

function compileValue(
  mode: string,
  literalType: string,
  literalValue: string,
  sourceAttr: string,
  start: string,
  end: string | undefined,
  isResource: boolean
) {
  if (mode === "literal") {
    if (literalType === "number") return String(Number(literalValue));
    if (literalType === "boolean") return literalValue === "true" ? "true" : "false";
    return JSON.stringify(literalValue);
  }
  const src = isResource ? `resource.attributes[${JSON.stringify(sourceAttr)}]` : `attributes[${JSON.stringify(sourceAttr)}]`;
  const s = Number(start) || 0;
  if (end == null) return `Substring(${src}, ${s})`;
  return `Substring(${src}, ${s}, ${Number(end)})`;
}

function compileWhere(chain: ConditionChain): string {
  const first = compileCmp(chain.first);
  const rest = chain.rest.map((c) => `${c.op} ${compileCmp(c.expr)}`);
  return [first, ...rest].join(" ");
}

function compileCmp(cmp: { attribute: string; operator: ConditionOperator; value?: JSONValue }) {
  const left = normalizeField(cmp.attribute);
  switch (cmp.operator) {
    case "exists":
      return `${left} != nil`;
    case "eq":
      return `${left} == ${valueLiteral(cmp.value)}`;
    case "neq":
      return `${left} != ${valueLiteral(cmp.value)}`;
    case "contains":
      return `Contains(${left}, ${valueLiteral(cmp.value)})`;
    case "starts":
      return `StartsWith(${left}, ${valueLiteral(cmp.value)})`;
    case "regex":
      return `RegexMatch(${left}, ${valueLiteral(cmp.value)})`;
  }
}

function valueLiteral(v: JSONValue | undefined): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return JSON.stringify(String(v ?? ""));
}

function normalizeField(name: string) {
  const n = (name || "").trim();
  if (n === "name") return "name";
  if (n === "kind") return "kind";
  if (n.includes(".")) return `attributes[${JSON.stringify(n)}]`;
  return `attributes[${JSON.stringify(n)}]`;
}

function appendWhere(where: string, clause: string) {
  if (!where) return ` where ${clause}`;
  return `${where} AND ${clause}`;
}


