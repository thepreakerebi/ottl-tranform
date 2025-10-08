"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { PopoverHeader, PopoverBody, PopoverFooter, PopoverSeparator } from "../../../components/ui/popover";
import { Separator } from "../../../components/ui/separator";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import type { ConditionGroup, ConditionNode, ConditionComparison } from "../../../lib/ottl/types";
import { useTelemetryStore } from "../../../lib/stores/telemetryStore";

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  description?: string;
  onApply: (summary: string, config: Record<string, unknown>) => void;
  onCancel?: () => void;
};

type LiteralType = "string" | "number" | "boolean";
type ValueMode = "literal" | "substring";
type CollisionPolicy = "upsert" | "skip" | "onlyIfMissing";
type ScopeValue = "resource" | "allSpans" | "rootSpans" | "allLogs" | "allDatapoints" | "conditional";

export default function AddAttributeBlockConfiguration({ signal, description: helpText, onApply, onCancel }: Props) {
  const scopes = useMemo(() => getScopes(signal), [signal]);
  const [scope, setScope] = useState<ScopeValue>(scopes[0]?.value ?? "resource");
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<ValueMode>("literal");
  const [literalType, setLiteralType] = useState<LiteralType>("string");
  const [literalValue, setLiteralValue] = useState("");
  const [sourceAttr, setSourceAttr] = useState("");
  const [substringStart, setSubstringStart] = useState("0");
  const [substringEnd, setSubstringEnd] = useState("");
  const [collision, setCollision] = useState<CollisionPolicy>("upsert");
  const [condition, setCondition] = useState<ConditionGroup | null>(null);
  const parsedTelemetry = useTelemetryStore((s) => s.parsed);

  const suggestions = useMemo(() => buildAttributeSuggestions(parsedTelemetry, signal, 100), [parsedTelemetry, signal]);

  // Ensure the selected scope remains valid if signal changes
  if (!scopes.some((s) => s.value === scope)) {
    // setState during render is safe here because it only runs when invalid
    // and will sync the controlled select to a defined value
    setScope(scopes[0]?.value ?? "resource");
  }

  // Initialize a default condition group when switching to conditional
  useEffect(() => {
    if (scope === "conditional" && !condition) {
      setCondition({ kind: "group", op: "AND", children: [
        { kind: "cmp", attribute: "", operator: "eq", value: "" }
      ] });
    }
    if (scope !== "conditional" && condition) {
      // Keep it around but it's ignored unless conditional; no action
    }
  }, [scope, condition]);

  const isValidValue = (mode === "literal" && (literalType !== undefined)) || (mode === "substring" && sourceAttr.trim().length > 0);
  const isValidCondition = scope !== "conditional" || (condition !== null && validateCondition(condition));
  const isValid = key.trim().length > 0 && isValidValue && isValidCondition;

  function handleApply() {
    const summary = buildSummary({ key, scope, mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, collision, condition });
    const config = { key, scope, mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, collision, condition };
    onApply(summary, config);
  }

  return (
    <section aria-label="Configure add attribute" className="w-full max-w-full flex flex-col">
      <PopoverHeader className="flex items-start justify-between">
        <section>
          <h3 className="text-sm font-semibold">Add attribute</h3>
          <p className="text-xs text-muted-foreground">{helpText || "Create or update an attribute on the selected scope"}</p>
        </section>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Close">✕</Button>
      </PopoverHeader>
      <PopoverSeparator />
      <PopoverBody className="max-h-[300px] space-y-4">
        <section className="space-y-4">
          <section>
            <Label className="text-xs font-medium" htmlFor="scope">Target scope</Label>
            <section className="mt-1 w-full">
              <Select value={scope} onValueChange={(v) => setScope(v as ScopeValue)}>
                <SelectTrigger id="scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          </section>
        {scope === "conditional" && condition && (
          <section>
            <Label className="text-xs font-medium">Conditions</Label>
            <section className="mt-2 space-y-3">
              {renderGroupEditor(condition, [], (updated) => setCondition(updated), suggestions)}
            </section>
            <p className="text-[11px] text-muted-foreground mt-1">Only items matching the expression will receive the attribute.</p>
          </section>
        )}
        </section>
        <Separator />
        <section className="space-y-4">
          <section>
            <Label className="text-xs font-medium" htmlFor="attr-key">Attribute key</Label>
            <section className="mt-1 w-full">
              <Input id="attr-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. service.env" className="w-full" />
            </section>
          </section>
          <section>
            <Label className="text-xs font-medium">Value</Label>
            <section className="mt-1 space-y-2">
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as ValueMode)} className="flex items-center gap-3 text-sm">
                <section className="flex items-center gap-2">
                  <RadioGroupItem id="mode-literal" value="literal" />
                  <Label htmlFor="mode-literal">Literal</Label>
                </section>
                <section className="flex items-center gap-2">
                  <RadioGroupItem id="mode-substring" value="substring" />
                  <Label htmlFor="mode-substring">Substring of attribute</Label>
                </section>
              </RadioGroup>
              {mode === "literal" && (
                <section className="space-y-2">
                  <section className="flex items-center gap-2">
                    <Select value={literalType} onValueChange={(v) => setLiteralType(v as LiteralType)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="boolean">boolean</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={literalValue} onChange={(e) => setLiteralValue(e.target.value)} placeholder="value" className="flex-1 min-w-0" />
                  </section>
                </section>
              )}
              {mode === "substring" && (
                <section className="space-y-2">
                  <Input value={sourceAttr} onChange={(e) => setSourceAttr(e.target.value)} placeholder="Source attribute key" className="w-full" />
                  <section className="flex items-center gap-2">
                    <Input value={substringStart} onChange={(e) => setSubstringStart(e.target.value)} placeholder="start" className="w-20" />
                    <Input value={substringEnd} onChange={(e) => setSubstringEnd(e.target.value)} placeholder="end (optional)" className="w-28" />
                  </section>
                </section>
              )}
            </section>
          </section>
          <section>
            <Label className="text-xs font-medium" htmlFor="collision">If key exists</Label>
            <section className="mt-1">
              <Select value={collision} onValueChange={(v) => setCollision(v as CollisionPolicy)}>
                <SelectTrigger id="collision" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Upsert (replace existing)</SelectItem>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="onlyIfMissing">Only if missing</SelectItem>
                </SelectContent>
              </Select>
            </section>
          </section>
        </section>
      </PopoverBody>
      <PopoverSeparator />
      <PopoverFooter className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!isValid} onClick={handleApply}>Apply</Button>
      </PopoverFooter>
    </section>
  );
}

function getScopes(signal: Props["signal"]): Array<{ value: ScopeValue; label: string }> {
  if (signal === "traces") {
    return [
      { value: "resource", label: "Resource" },
      { value: "allSpans", label: "All spans" },
      { value: "rootSpans", label: "Root spans only" },
      { value: "conditional", label: "Conditional" },
    ];
  }
  if (signal === "logs") {
    return [
      { value: "resource", label: "Resource" },
      { value: "allLogs", label: "All log records" },
      { value: "conditional", label: "Conditional" },
    ];
  }
  if (signal === "metrics") {
    return [
      { value: "resource", label: "Resource" },
      { value: "allDatapoints", label: "All datapoints" },
      { value: "conditional", label: "Conditional" },
    ];
  }
  return [
    { value: "resource", label: "Resource" },
    { value: "conditional", label: "Conditional" },
  ];
}

function buildSummary(cfg: Record<string, unknown>) {
  const scopeLabel = String(cfg.scope);
  const key = String(cfg.key || "");
  const mode = String(cfg.mode);
  if (mode === "literal") {
    return `Upsert ${key} = ${String(cfg.literalValue || "")} on ${scopeLabel}`;
  }
  if (mode === "fromAttr") {
    return `Set ${key} from attr ${String(cfg.sourceAttr || "")} on ${scopeLabel}`;
  }
  const cond = cfg.condition ? ` where ${summarizeCondition(cfg.condition as ConditionNode)}` : "";
  return `Set ${key} from substring of ${String(cfg.sourceAttr || "")} on ${scopeLabel}${cond}`;
}



// ---- Condition builder helpers ----
function validateCondition(node: ConditionNode): boolean {
  if (node.kind === "cmp") {
    if (node.operator === "exists") return node.attribute.trim().length > 0;
    return node.attribute.trim().length > 0 && node.value !== undefined && String(node.value).length > 0;
  }
  // group
  return node.children.length > 0 && node.children.every(validateCondition);
}

function summarizeCondition(node: ConditionNode): string {
  if (node.kind === "cmp") {
    const op = node.operator === "eq" ? "=" : node.operator === "neq" ? "≠" : node.operator;
    if (node.operator === "exists") return `${node.attribute} exists`;
    return `${node.attribute} ${op} ${String(node.value ?? "")}`;
  }
  const inner = node.children.map(summarizeCondition).join(` ${node.op} `);
  const text = node.not ? `NOT(${inner})` : inner;
  return node.children.length > 1 ? `(${text})` : text;
}

function renderGroupEditor(group: ConditionGroup, path: number[], onChange: (g: ConditionGroup) => void, suggestions: string[]): React.ReactNode {
  return (
    <section className="space-y-2 border rounded p-2">
      <section className="flex items-center gap-2">
        <Label className="text-xs">Group operator</Label>
        <Select value={group.op} onValueChange={(v) => onChange({ ...group, op: v as ConditionGroup["op"] })}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-xs ml-2">NOT</Label>
        <RadioGroup value={group.not ? "true" : "false"} onValueChange={(v) => onChange({ ...group, not: v === "true" })} className="flex items-center gap-2">
          <section className="flex items-center gap-1">
            <RadioGroupItem id={`not-${path.join('-')}-no`} value="false" />
            <Label htmlFor={`not-${path.join('-')}-no`}>No</Label>
          </section>
          <section className="flex items-center gap-1">
            <RadioGroupItem id={`not-${path.join('-')}-yes`} value="true" />
            <Label htmlFor={`not-${path.join('-')}-yes`}>Yes</Label>
          </section>
        </RadioGroup>
        <section className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onChange({ ...group, children: [...group.children, emptyComparison()] })}>Add condition</Button>
          <Button type="button" variant="outline" onClick={() => onChange({ ...group, children: [...group.children, emptyGroup()] })}>Add group</Button>
        </section>
      </section>
      <section className="space-y-2">
        {group.children.map((child, idx) => (
          <section key={idx} className="flex items-start gap-2">
            {child.kind === "cmp" ? (
              renderComparison(child, (next) => {
                const children = group.children.slice();
                children[idx] = next;
                onChange({ ...group, children });
              }, suggestions)
            ) : (
              <section className="flex-1">
                {renderGroupEditor(child, [...path, idx], (nextGroup) => {
                  const children = group.children.slice();
                  children[idx] = nextGroup;
                  onChange({ ...group, children });
                }, suggestions)}
              </section>
            )}
            <Button type="button" variant="ghost" onClick={() => {
              const children = group.children.slice();
              children.splice(idx, 1);
              onChange({ ...group, children });
            }}>Remove</Button>
          </section>
        ))}
      </section>
    </section>
  );
}

function renderComparison(cmp: ConditionComparison, onChange: (c: ConditionComparison) => void, suggestions: string[]): React.ReactNode {
  return (
    <section className="flex items-center gap-2 w-full">
      <Input list="attr-suggestions" placeholder="Attribute path (e.g. span.name or resource.attributes['service.name'])" value={cmp.attribute} onChange={(e) => onChange({ ...cmp, attribute: e.target.value })} className="flex-1" />
      <Select value={cmp.operator} onValueChange={(v) => onChange({ ...cmp, operator: v as ConditionComparison["operator"] })}>
        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="eq">=</SelectItem>
          <SelectItem value="neq">≠</SelectItem>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="starts">starts with</SelectItem>
          <SelectItem value="regex">regex</SelectItem>
          <SelectItem value="exists">exists</SelectItem>
        </SelectContent>
      </Select>
      {cmp.operator !== "exists" && (
        <Input placeholder="Value" value={String(cmp.value ?? "")} onChange={(e) => onChange({ ...cmp, value: e.target.value })} className="w-[200px]" />
      )}
      <datalist id="attr-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </section>
  );
}

function emptyGroup(): ConditionGroup {
  return { kind: "group", op: "AND", children: [emptyComparison()] };
}

function emptyComparison(): ConditionComparison {
  return { kind: "cmp", attribute: "", operator: "eq", value: "" };
}

function buildAttributeSuggestions(parsed: unknown, signal: Props["signal"], cap: number): string[] {
  const set = new Set<string>();
  function walk(obj: unknown, path: string[]) {
    if (set.size >= cap) return;
    if (obj !== null && typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => walk(v, path.concat(String(i))));
      } else {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const nextPath = path.concat(k);
          // offer dotted path
          set.add(nextPath.join("."));
          walk(v, nextPath);
        }
      }
    }
  }
  walk(parsed, []);
  return Array.from(set).slice(0, cap);
}