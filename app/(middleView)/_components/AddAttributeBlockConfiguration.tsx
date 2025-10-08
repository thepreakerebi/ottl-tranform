"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { PopoverHeader, PopoverBody, PopoverFooter, PopoverSeparator } from "../../../components/ui/popover";
import { Separator } from "../../../components/ui/separator";

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  description?: string;
  onApply: (summary: string, config: Record<string, unknown>) => void;
  onCancel?: () => void;
};

type LiteralType = "string" | "number" | "boolean";
type ValueMode = "literal" | "fromAttr" | "substring";
type CollisionPolicy = "upsert" | "skip" | "onlyIfMissing";
type ScopeValue = "resource" | "allSpans" | "rootSpans" | "allLogs" | "allDatapoints";

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
            <label className="text-xs font-medium">Target scope</label>
            <section className="mt-1 w-full">
              <select value={scope} onChange={(e) => setScope(e.target.value as ScopeValue)} className="w-full rounded border px-2 py-1 text-sm bg-background">
                {scopes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </section>
          </section>
          <section>
            <label className="text-xs font-medium">Condition (optional)</label>
            <section className="mt-1 grid grid-cols-1 gap-2 w-full">
              <input placeholder="Attribute (e.g. http.status_code)" className="rounded border px-2 py-1 text-sm bg-background w-full" />
              <section className="flex items-center gap-2">
                <select className="rounded border px-2 py-1 text-sm bg-background">
                  <option value="eq">=</option>
                  <option value="neq">≠</option>
                  <option value="contains">contains</option>
                  <option value="starts">starts with</option>
                  <option value="regex">regex</option>
                  <option value="exists">exists</option>
                </select>
                <input placeholder="Value" className="flex-1 min-w-0 rounded border px-2 py-1 text-sm bg-background" />
              </section>
            </section>
            <p className="text-[11px] text-muted-foreground mt-1">When provided, the attribute is added only where the condition matches.</p>
          </section>
        </section>
        <Separator />
        <section className="space-y-4">
          <section>
            <label className="text-xs font-medium">Attribute key</label>
            <section className="mt-1 w-full">
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. service.env" className="w-full rounded border px-2 py-1 text-sm bg-background" />
            </section>
          </section>
          <section>
            <label className="text-xs font-medium">Value</label>
            <section className="mt-1 space-y-2">
              <section className="flex items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-1"><input type="radio" name="mode" checked={mode === "literal"} onChange={() => setMode("literal")} /> Literal</label>
                <label className="inline-flex items-center gap-1"><input type="radio" name="mode" checked={mode === "fromAttr"} onChange={() => setMode("fromAttr")} /> From attribute</label>
                <label className="inline-flex items-center gap-1"><input type="radio" name="mode" checked={mode === "substring"} onChange={() => setMode("substring")} /> Substring of attribute</label>
              </section>
              {mode === "literal" && (
                <section className="space-y-2">
                  <section className="flex items-center gap-2">
                    <select value={literalType} onChange={(e) => setLiteralType(e.target.value as LiteralType)} className="rounded border px-2 py-1 text-sm bg-background">
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <input value={literalValue} onChange={(e) => setLiteralValue(e.target.value)} placeholder="value" className="flex-1 min-w-0 rounded border px-2 py-1 text-sm bg-background" />
                  </section>
                </section>
              )}
              {mode === "fromAttr" && (
                <section className="space-y-2">
                  <input value={sourceAttr} onChange={(e) => setSourceAttr(e.target.value)} placeholder="Source attribute key" className="w-full max-w-full rounded border px-2 py-1 text-sm bg-background" />
                </section>
              )}
              {mode === "substring" && (
                <section className="space-y-2">
                  <input value={sourceAttr} onChange={(e) => setSourceAttr(e.target.value)} placeholder="Source attribute key" className="w-full max-w-full rounded border px-2 py-1 text-sm bg-background" />
                  <section className="flex items-center gap-2">
                    <input value={substringStart} onChange={(e) => setSubstringStart(e.target.value)} placeholder="start" className="rounded border px-2 py-1 text-sm bg-background w-20" />
                    <input value={substringEnd} onChange={(e) => setSubstringEnd(e.target.value)} placeholder="end (optional)" className="rounded border px-2 py-1 text-sm bg-background w-28" />
                  </section>
                </section>
              )}
            </section>
          </section>
          <section>
            <label className="text-xs font-medium">If key exists</label>
            <section className="mt-1">
              <select value={collision} onChange={(e) => setCollision(e.target.value as CollisionPolicy)} className="w-full max-w-full rounded border px-2 py-1 text-sm bg-background">
                <option value="upsert">Upsert (replace existing)</option>
                <option value="skip">Skip</option>
                <option value="onlyIfMissing">Only if missing</option>
              </select>
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
    ];
  }
  if (signal === "logs") {
    return [
      { value: "resource", label: "Resource" },
      { value: "allLogs", label: "All log records" },
    ];
  }
  if (signal === "metrics") {
    return [
      { value: "resource", label: "Resource" },
      { value: "allDatapoints", label: "All datapoints" },
    ];
  }
  return [
    { value: "resource", label: "Resource" },
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


