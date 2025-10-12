"use client";

import AttributesTable from "./AttributesTable";
import { Button } from "../../../components/ui/button";
import { Plus } from "lucide-react";

type LogRecord = {
  timeUnixNano?: string;
  severityText?: string;
  body?: Record<string, unknown> | string;
  attributes?: Array<{ key: string; value: Record<string, unknown> }>;
};

type Props = { record: LogRecord };

export default function LogCard({ record }: Props) {
  const { timeUnixNano, severityText, body } = record;
  const bodyText = typeof body === "string" ? body : stringifyBody(body);
  return (
    <article className="rounded-md border bg-card text-card-foreground p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{severityText ?? "Log"}</h3>
        <section className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{timeUnixNano ?? "—"}</span>
          <Button type="button" variant="outline" size="sm" className="rounded-[6px]"> <Plus className="size-4" /> Add attribute</Button>
        </section>
      </header>
      {bodyText && (
        <p className="mt-1 text-xs text-foreground/80 break-words">{bodyText}</p>
      )}
      <AttributesTable attributes={record.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} />
    </article>
  );
}

function stringifyBody(b?: Record<string, unknown>) {
  if (!b) return "";
  const k = Object.keys(b)[0];
  const v = k ? b[k] : undefined;
  try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v ?? ""); }
}


