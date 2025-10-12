"use client";

import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Trash2, ScanText } from "lucide-react";

type AttributeKV = { key: string; value: Record<string, unknown> };

type RowActions = {
  onRemove?: (key: string) => void;
  onMask?: (key: string) => void;
};

type Props = {
  title?: string;
  attributes?: unknown;
  actions?: RowActions;
};

export default function AttributesTable({ title = "Attributes", attributes, actions }: Props) {
  const rows = normalizeAttributes(attributes);
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className="mt-3">
      <header className="mb-2">
        <Label className="text-xs font-medium">{title}</Label>
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th scope="col" className="text-left font-semibold py-1 pr-2">Key</th>
            <th scope="col" className="text-left font-semibold py-1">Value</th>
            {actions && (actions.onRemove || actions.onMask) ? (
              <th scope="col" className="text-right font-semibold py-1 pr-1">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t align-top">
              <th scope="row" className="py-1 pr-2 text-left text-foreground/90 font-medium whitespace-nowrap align-top">{r.key}</th>
              <td className="py-1 text-left text-foreground/80 break-words align-top">{r.value}</td>
              {actions && (actions.onRemove || actions.onMask) ? (
                <td className="py-1 text-right whitespace-nowrap">
                  {actions.onRemove && (
                    <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${r.key}`} onClick={() => actions.onRemove?.(r.key)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                  {actions.onMask && (
                    <Button type="button" variant="ghost" size="sm" aria-label={`Mask ${r.key}`} onClick={() => actions.onMask?.(r.key)}>
                      <ScanText className="size-4" />
                    </Button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function normalizeAttributes(attrs: unknown): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const list = Array.isArray(attrs) ? (attrs as AttributeKV[]) : [];
  for (const kv of list) {
    if (!kv || typeof kv !== "object" || typeof (kv as AttributeKV).key !== "string") continue;
    const key = (kv as AttributeKV).key;
    const v = (kv as AttributeKV).value;
    const value = v && typeof v === "object" ? stringifyFirst(v) : "";
    out.push({ key, value });
  }
  return out;
}

function stringifyFirst(v: Record<string, unknown>): string {
  const firstKey = Object.keys(v)[0];
  const val = firstKey ? v[firstKey] : undefined;
  try {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val);
    if (val == null) return "";
    return JSON.stringify(val);
  } catch {
    return String(val ?? "");
  }
}


