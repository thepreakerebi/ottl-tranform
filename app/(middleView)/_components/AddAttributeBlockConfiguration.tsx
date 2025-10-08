"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { PopoverHeader, PopoverBody, PopoverFooter, PopoverSeparator } from "../../../components/ui/popover";
import { Separator } from "../../../components/ui/separator";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import type { ConditionChain, ConditionComparison } from "../../../lib/ottl/types";
import TargetLevelSelect from "./TargetLevelSelect";
import ConditionChainBuilder from "./ConditionChainBuilder";
// import { useTelemetryStore } from "../../../lib/stores/telemetryStore";

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  description?: string;
  onApply: (summary: string, config: Record<string, unknown>) => void;
  onCancel?: () => void;
  initialConfig?: Record<string, unknown>;
};

type LiteralType = "string" | "number" | "boolean";
type ValueMode = "literal" | "substring";
type CollisionPolicy = "upsert" | "skip" | "onlyIfMissing";
type ScopeValue = import("./TargetLevelSelect").ScopeValue;

export default function AddAttributeBlockConfiguration({ signal, description: helpText, onApply, onCancel, initialConfig }: Props) {
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
  const [condition, setCondition] = useState<ConditionChain | null>(null);
  // We no longer surface verbose suggestions; allow free typing for "where" field

  // Ensure the selected scope remains valid if signal changes
  if (!scopes.some((s) => s.value === scope)) {
    setScope(scopes[0]?.value ?? "resource");
  }

  // Initialize a default condition row when switching to conditional
  useEffect(() => {
    if (scope === "conditional" && !condition) {
      setCondition({ first: { kind: "cmp", attribute: "", operator: "eq", value: "" }, rest: [] });
    }
    if (scope !== "conditional" && condition) {
      // Keep it around but it's ignored unless conditional; no action
    }
  }, [scope, condition]);

  // Hydrate from initialConfig when provided (e.g., opening an existing block)
  useEffect(() => {
    if (!initialConfig) return;
    const ic = initialConfig as Record<string, unknown>;
    if (typeof ic["key"] === "string") setKey(ic["key"] as string);
    if (typeof ic["scope"] === "string") setScope(ic["scope"] as ScopeValue);
    if (typeof ic["mode"] === "string") setMode(ic["mode"] as ValueMode);
    if (typeof ic["literalType"] === "string") setLiteralType(ic["literalType"] as LiteralType);
    if (typeof ic["literalValue"] === "string") setLiteralValue(ic["literalValue"] as string);
    if (typeof ic["sourceAttr"] === "string") setSourceAttr(ic["sourceAttr"] as string);
    if (typeof ic["substringStart"] === "string") setSubstringStart(ic["substringStart"] as string);
    if (typeof ic["substringEnd"] === "string") setSubstringEnd(ic["substringEnd"] as string);
    if (typeof ic["collision"] === "string") setCollision(ic["collision"] as CollisionPolicy);
    if (ic["condition"]) {
      try {
        const c = ic["condition"] as ConditionChain;
        if (c && c.first && typeof c.first === "object") setCondition(c);
      } catch {
        // ignore bad shape
      }
    }
  }, [initialConfig]);

  const isValidValue = (mode === "literal" && (literalType !== undefined)) || (mode === "substring" && sourceAttr.trim().length > 0);
  const isValidCondition = scope !== "conditional" || (condition !== null && validateChain(condition));
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
          <TargetLevelSelect signal={signal} value={scope} onChange={setScope} />
        {scope === "conditional" && condition && (
          <ConditionChainBuilder value={condition} onChange={setCondition} />
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
            <Label className="text-xs font-medium">Attribute value</Label>
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
        <Button type="button" disabled={!isValid} onClick={handleApply}>Save</Button>
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
  const cond = cfg.condition ? ` where ${summarizeChain(cfg.condition as ConditionChain)}` : "";
  return `Set ${key} from substring of ${String(cfg.sourceAttr || "")} on ${scopeLabel}${cond}`;
}



// ---- Flat condition chain helpers ----
function validateCondition(cmp: ConditionComparison): boolean {
  if (cmp.operator === "exists") return cmp.attribute.trim().length > 0;
  return cmp.attribute.trim().length > 0 && cmp.value !== undefined && String(cmp.value).length > 0;
}

function summarizeCmp(cmp: ConditionComparison): string {
  const op = cmp.operator === "eq" ? "=" : cmp.operator === "neq" ? "≠" : cmp.operator;
  if (cmp.operator === "exists") return `${cmp.attribute} exists`;
  return `${cmp.attribute} ${op} ${String(cmp.value ?? "")}`;
}

function summarizeChain(chain: ConditionChain): string {
  const parts = [summarizeCmp(chain.first), ...chain.rest.map((c) => `${c.op} ${summarizeCmp(c.expr)}`)];
  return parts.join(" ");
}

function validateChain(chain: ConditionChain): boolean {
  if (!validateCondition(chain.first)) return false;
  return chain.rest.every((c) => validateCondition(c.expr));
}

// Suggestions removed for MVP simplicity