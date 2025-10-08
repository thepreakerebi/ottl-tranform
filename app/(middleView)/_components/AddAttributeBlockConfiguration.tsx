"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { PopoverHeader, PopoverBody, PopoverFooter, PopoverSeparator } from "../../../components/ui/popover";
import { Separator } from "../../../components/ui/separator";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  description?: string;
  onApply: (summary: string, config: Record<string, unknown>) => void;
  onCancel?: () => void;
};

type LiteralType = "string" | "number" | "boolean";
type ValueMode = "literal" | "fromAttr" | "substring";
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

  // Ensure the selected scope remains valid if signal changes
  if (!scopes.some((s) => s.value === scope)) {
    // setState during render is safe here because it only runs when invalid
    // and will sync the controlled select to a defined value
    setScope(scopes[0]?.value ?? "resource");
  }

  const isValid = key.trim().length > 0 && (
    (mode === "literal" && (literalType !== undefined)) ||
    (mode === "fromAttr" && sourceAttr.trim().length > 0) ||
    (mode === "substring" && sourceAttr.trim().length > 0)
  );

  function handleApply() {
    const summary = buildSummary({ key, scope, mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, collision });
    const config = { key, scope, mode, literalType, literalValue, sourceAttr, substringStart, substringEnd, collision };
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
        {scope === "conditional" && (
          <section>
            <Label className="text-xs font-medium" htmlFor="cond-attr">Condition</Label>
            <section className="mt-1 grid grid-cols-1 gap-2 w-full">
              <Input id="cond-attr" placeholder="Attribute (e.g. http.status_code)" className="w-full" />
              <section className="flex items-center gap-2">
                <Select defaultValue="eq">
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">=</SelectItem>
                    <SelectItem value="neq">≠</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="starts">starts with</SelectItem>
                    <SelectItem value="regex">regex</SelectItem>
                    <SelectItem value="exists">exists</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Value" className="flex-1 min-w-0" />
              </section>
            </section>
            <p className="text-[11px] text-muted-foreground mt-1">Only items matching this condition will receive the attribute.</p>
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
                  <RadioGroupItem id="mode-from" value="fromAttr" />
                  <Label htmlFor="mode-from">From attribute</Label>
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
              {mode === "fromAttr" && (
                <section className="space-y-2">
                  <Input value={sourceAttr} onChange={(e) => setSourceAttr(e.target.value)} placeholder="Source attribute key" className="w-full" />
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
  return `Set ${key} from substring of ${String(cfg.sourceAttr || "")} on ${scopeLabel}`;
}


