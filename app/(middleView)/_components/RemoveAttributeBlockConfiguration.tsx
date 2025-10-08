"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { PopoverHeader, PopoverBody, PopoverFooter, PopoverSeparator } from "../../../components/ui/popover";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import TargetLevelSelect from "./TargetLevelSelect";
import type { ConditionChain } from "../../../lib/ottl/types";
import ConditionChainBuilder from "./ConditionChainBuilder";
import { useTelemetryStore } from "../../../lib/stores/telemetryStore";

type ScopeValue = import("./TargetLevelSelect").ScopeValue;

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  description?: string;
  onApply: (summary: string, config: Record<string, unknown>) => void;
  onCancel?: () => void;
  initialConfig?: Record<string, unknown>;
};

export default function RemoveAttributeBlockConfiguration({ signal, description: helpText, onApply, onCancel, initialConfig }: Props) {
  const scopes = useMemo(() => getScopes(signal), [signal]);
  const [scope, setScope] = useState<ScopeValue>(scopes[0]?.value ?? "resource");
  const [keys, setKeys] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState("");
  const [condition, setCondition] = useState<ConditionChain | null>(null);
  const parsed = useTelemetryStore((s) => s.parsed);

  if (!scopes.some((s) => s.value === scope)) setScope(scopes[0]?.value ?? "resource");

  useEffect(() => {
    if (scope === "conditional" && !condition) {
      setCondition({ first: { kind: "cmp", attribute: "", operator: "eq", value: "" }, rest: [] });
    }
  }, [scope, condition]);

  useEffect(() => {
    if (!initialConfig) return;
    const ic = initialConfig as Record<string, unknown>;
    if (typeof ic["scope"] === "string") setScope(ic["scope"] as ScopeValue);
    if (Array.isArray(ic["keys"])) setKeys(ic["keys"] as string[]);
    if (ic["condition"]) {
      try { setCondition(ic["condition"] as ConditionChain); } catch {}
    }
  }, [initialConfig]);

  const discovered = useMemo(() => discoverAttributeKeys(parsed, signal, scope), [parsed, signal, scope]);
  const canSave = keys.length > 0 && (scope !== "conditional" || !!(condition && validateChain(condition)));

  function addKey(k: string) {
    const v = k.trim();
    if (!v) return;
    if (!keys.includes(v)) setKeys((arr) => [...arr, v]);
    setInputKey("");
  }

  function removeKey(k: string) {
    setKeys((arr) => arr.filter((x) => x !== k));
  }

  function handleApply() {
    const summary = buildSummary(scope, keys, condition || undefined);
    const config = { scope, keys, condition };
    onApply(summary, config);
  }

  return (
    <section aria-label="Configure remove attribute" className="w-full max-w-full flex flex-col">
      <PopoverHeader className="flex items-start justify-between">
        <section>
          <h3 className="text-sm font-semibold">Remove attribute</h3>
          <p className="text-xs text-muted-foreground">{helpText || "Delete attributes on the selected level"}</p>
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
        <section className="space-y-2">
          <Label className="text-xs font-medium">Attribute Key(s) to Remove</Label>
          {discovered.length > 0 && (
            <section className="flex flex-wrap gap-2" aria-label="Discovered keys">
              {discovered.map((k) => (
                <Button key={k} type="button" variant={keys.includes(k) ? "default" : "outline"} size="sm" onClick={() => addKey(k)}>
                  {k}
                </Button>
              ))}
            </section>
          )}
          <section className="flex items-center gap-2">
            <Input value={inputKey} onChange={(e) => setInputKey(e.target.value)} placeholder="Type and press Enter to add" className="flex-1" onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKey(inputKey);
              }
            }} />
            <Button type="button" variant="outline" onClick={() => addKey(inputKey)}>Add</Button>
          </section>
          {keys.length > 0 && (
            <section className="flex flex-wrap gap-2 mt-2" aria-label="Selected keys">
              {keys.map((k) => (
                <Button key={k} type="button" size="sm" variant="secondary" onClick={() => removeKey(k)} aria-label={`Remove ${k}`}>
                  {k} ×
                </Button>
              ))}
            </section>
          )}
        </section>
      </PopoverBody>
      <PopoverSeparator />
      <PopoverFooter className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!canSave} onClick={handleApply}>Save</Button>
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

function buildSummary(scope: ScopeValue, keys: string[], condition?: ConditionChain) {
  const base = `Delete ${keys.length} ${keys.length === 1 ? "attribute" : "attributes"} on ${scope}`;
  if (condition) {
    return `${base} where ${summarizeChain(condition)}`;
  }
  return base;
}

function summarizeChain(chain: ConditionChain): string {
  const parts = [summarizeCmp(chain.first), ...chain.rest.map((c) => `${c.op} ${summarizeCmp(c.expr)}`)];
  return parts.join(" ");
}

function summarizeCmp(cmp: ConditionChain["first"]): string {
  const op = cmp.operator === "eq" ? "=" : cmp.operator === "neq" ? "≠" : cmp.operator;
  if (cmp.operator === "exists") return `${cmp.attribute} exists`;
  return `${cmp.attribute} ${op} ${String(cmp.value ?? "")}`;
}

function validateChain(chain: ConditionChain): boolean {
  if (!chain.first.attribute.trim()) return false;
  if (chain.first.operator !== "exists" && String(chain.first.value ?? "").length === 0) return false;
  return chain.rest.every((c) => {
    if (!c.expr.attribute.trim()) return false;
    if (c.expr.operator !== "exists" && String(c.expr.value ?? "").length === 0) return false;
    return true;
  });
}

function discoverAttributeKeys(parsed: unknown, signal: Props["signal"], scope: ScopeValue): string[] {
  try {
    const doc = parsed as Record<string, unknown>;
    const set = new Set<string>();
    if (signal === "traces") {
      const rss = asArray(doc["resourceSpans"]);
      for (const rs of rss) {
        const rsRec = asRecord(rs);
        if (!rsRec) continue;
        if (scope === "resource") collectKeysFromAttributes(asRecord(rsRec["resource"])?.attributes, set);
        const scopeSpans = asArray(rsRec["scopeSpans"]);
        for (const ss of scopeSpans) {
          const ssRec = asRecord(ss);
          if (!ssRec) continue;
          if (scope === "allSpans" || scope === "rootSpans" || scope === "conditional") {
            const spans = asArray(ssRec["spans"]);
            for (const sp of spans) {
              const spRec = asRecord(sp);
              collectKeysFromAttributes(spRec?.attributes, set);
            }
          }
        }
      }
    } else if (signal === "logs") {
      const rls = asArray(doc["resourceLogs"]);
      for (const rl of rls) {
        const rlRec = asRecord(rl);
        if (!rlRec) continue;
        if (scope === "resource") collectKeysFromAttributes(asRecord(rlRec["resource"])?.attributes, set);
        const scopeLogs = asArray(rlRec["scopeLogs"]);
        for (const sl of scopeLogs) {
          const slRec = asRecord(sl);
          if (!slRec) continue;
          if (scope === "allLogs" || scope === "conditional") {
            const logRecords = asArray(slRec["logRecords"]);
            for (const lr of logRecords) {
              const lrRec = asRecord(lr);
              collectKeysFromAttributes(lrRec?.attributes, set);
            }
          }
        }
      }
    } else if (signal === "metrics") {
      const rms = asArray(doc["resourceMetrics"]);
      for (const rm of rms) {
        const rmRec = asRecord(rm);
        if (!rmRec) continue;
        if (scope === "resource") collectKeysFromAttributes(asRecord(rmRec["resource"])?.attributes, set);
        const scopeMetrics = asArray(rmRec["scopeMetrics"]);
        for (const sm of scopeMetrics) {
          const smRec = asRecord(sm);
          if (!smRec) continue;
          const metrics = asArray(smRec["metrics"]);
          for (const m of metrics) {
            const mRec = asRecord(m);
            if (!mRec) continue;
            const sum = asRecord(mRec["sum"]);
            const gauge = asRecord(mRec["gauge"]);
            const histogram = asRecord(mRec["histogram"]);
            const dps = asArray(sum?.["dataPoints"] ?? gauge?.["dataPoints"] ?? histogram?.["dataPoints"]);
            if (scope === "allDatapoints" || scope === "conditional") {
              for (const dp of dps) {
                const dpRec = asRecord(dp);
                collectKeysFromAttributes(dpRec?.attributes, set);
              }
            }
          }
        }
      }
    }
    return Array.from(set).slice(0, 50);
  } catch {
    return [];
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function collectKeysFromAttributes(attrs: unknown, set: Set<string>) {
  const arr = asArray(attrs);
  for (const a of arr) {
    const rec = asRecord(a);
    const k = rec?.["key"];
    if (typeof k === "string" && k) set.add(k);
  }
}


