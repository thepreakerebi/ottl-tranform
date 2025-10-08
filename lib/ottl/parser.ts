import type { Block, ConditionChain, ConditionComparison } from "./types";

type Scope = "resource" | "allSpans" | "rootSpans" | "allLogs" | "allDatapoints";

export function parseOttlToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split(/\r?\n/);
  let context: Scope | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    const ctx = raw.match(/^context:\s*(resource|span|log|datapoint)/);
    if (ctx) {
      const c = ctx[1];
      context = c === "resource" ? "resource" : c === "span" ? "allSpans" : c === "log" ? "allLogs" : "allDatapoints";
      continue;
    }
    if (!context) continue;
    const stmt = raw.match(/^-(?:\s*)set\((.+)\)\s*(?:where\s+(.+))?$/);
    if (!stmt) continue;
    const inside = stmt[1];
    let where = stmt[2] || "";
    // key and value
    const resMatch = inside.match(/^resource\.attributes\["([^"]+)"\],\s*(.+)$/);
    const spanMatch = inside.match(/^attributes\["([^"]+)"\],\s*(.+)$/);
    const m = resMatch || spanMatch;
    if (!m) continue;
    const key = m[1];
    const valueExpr = m[2];

    // Detect root span marker
    if (context === "allSpans" && /\bIsRootSpan\(\)/.test(where)) {
      context = "rootSpans";
      where = where.replace(/\s*AND\s*IsRootSpan\(\)/, "").replace(/IsRootSpan\(\)\s*AND\s*/, "");
    }

    // Value mode
    let mode: "literal" | "substring" = "literal";
    let literalType: "string" | "number" | "boolean" = "string";
    let literalValue = "";
    let sourceAttr = "";
    let substringStart = "0";
    let substringEnd: string | undefined = undefined;

    const substr = valueExpr.match(/^Substring\(attributes\["([^"]+)"\],\s*(\d+)(?:,\s*(\d+))?\)$/);
    if (substr) {
      mode = "substring";
      sourceAttr = substr[1];
      substringStart = substr[2] || "0";
      substringEnd = substr[3];
    } else if (/^(true|false)$/.test(valueExpr)) {
      mode = "literal";
      literalType = "boolean";
      literalValue = valueExpr === "true" ? "true" : "false";
    } else if (/^-?\d+(?:\.\d+)?$/.test(valueExpr)) {
      mode = "literal";
      literalType = "number";
      literalValue = valueExpr;
    } else {
      const str = valueExpr.match(/^"([\s\S]*)"$/);
      literalType = "string";
      literalValue = str ? str[1] : valueExpr.replace(/^"|"$/g, "");
    }

    // Where -> flat chain (best-effort)
    const chain = where ? parseWhere(where) : null;

    const id = `addAttribute-${blocks.length + 1}-${Date.now()}`;
    blocks.push({
      id,
      type: "addAttribute",
      signal: "traces", // default; evaluator uses scope
      enabled: true,
      config: {
        key,
        scope: context,
        mode,
        literalType,
        literalValue,
        sourceAttr,
        substringStart,
        substringEnd,
        collision: "upsert",
        condition: chain,
      },
    });
  }
  return blocks;
}

function parseWhere(where: string) {
  // Split by AND/OR preserving order
  const parts: Array<{ op?: "AND" | "OR"; expr: string }> = [];
  let rest = where.trim();
  while (rest.length) {
    const m = rest.match(/\s+(AND|OR)\s+/);
    if (!m) {
      parts.push({ expr: rest });
      break;
    }
    const idx = m.index as number;
    parts.push({ expr: rest.slice(0, idx) });
    parts.push({ op: m[1] as "AND" | "OR", expr: rest.slice(idx + m[0].length) });
    // continue with last item
    rest = parts.pop()!.expr;
  }

  const first = compileCmpToNode(parts.shift()?.expr || where);
  const restNodes = parts
    .filter((p) => p.op)
    .map((p) => ({ op: p.op as "AND" | "OR", expr: compileCmpToNode(p.expr) }));
  return { first, rest: restNodes } as ConditionChain;
}

function compileCmpToNode(expr: string): ConditionComparison {
  const e = expr.trim();
  // name == "foo"
  let m = e.match(/^(name|kind|attributes\["[^"]+"\])\s*([!=]=)\s*(.+)$/);
  if (m) {
    return {
      kind: "cmp",
      attribute: normalizeAttr(m[1]),
      operator: m[2] === "==" ? "eq" : "neq",
      value: stripQuotes(m[3]),
    };
  }
  // Contains(attributes["k"], "v") and StartsWith/RegexMatch
  m = e.match(/^(Contains|StartsWith|RegexMatch)\((.+?),\s*(.+)\)$/);
  if (m) {
    const fn = m[1];
    const left = normalizeAttr(m[2]);
    const val = stripQuotes(m[3]);
    const op = fn === "Contains" ? "contains" : fn === "StartsWith" ? "starts" : "regex";
    return { kind: "cmp", attribute: left, operator: op, value: val } as ConditionComparison;
  }
  // fallback exists
  return { kind: "cmp", attribute: normalizeAttr(e), operator: "exists" } as ConditionComparison;
}

function normalizeAttr(s: string) {
  const t = s.trim();
  if (t === "name" || t === "kind") return t;
  const m = t.match(/^attributes\["([^"]+)"\]$/);
  if (m) return m[1];
  return t;
}

function stripQuotes(v: string) {
  const t = v.trim();
  if (/^".*"$/.test(t)) return t.slice(1, -1);
  if (t === "true" || t === "false") return t === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return t;
}


