"use client";

import { useMemo } from "react";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

export type ScopeValue = "resource" | "allSpans" | "rootSpans" | "allLogs" | "allDatapoints" | "conditional";

type Props = {
  signal: "traces" | "logs" | "metrics" | "general" | "unknown";
  value: ScopeValue;
  onChange: (v: ScopeValue) => void;
  id?: string;
  label?: string;
};

export default function TargetLevelSelect({ signal, value, onChange, id = "scope", label = "Target level" }: Props) {
  const scopes = useMemo(() => getScopes(signal), [signal]);

  // Keep value valid when signal changes
  const safeValue = scopes.some((s) => s.value === value) ? value : (scopes[0]?.value ?? "resource");

  return (
    <section>
      <Label className="text-xs font-medium" htmlFor={id}>{label}</Label>
      <section className="mt-1 w-full">
        <Select value={safeValue} onValueChange={(v) => onChange(v as ScopeValue)}>
          <SelectTrigger id={id} className="w-full">
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
  );
}

export function getScopes(signal: Props["signal"]): Array<{ value: ScopeValue; label: string }> {
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


