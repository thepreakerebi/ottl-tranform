"use client";

import AttributesTable from "./AttributesTable";
import { Button } from "../../../components/ui/button";
import { Plus } from "lucide-react";

type Span = {
  name?: string;
  kind?: number | string;
  spanId?: string;
  traceId?: string;
  attributes?: Array<{ key: string; value: Record<string, unknown> }>;
};

type Props = {
  span: Span;
};

export default function SpanCard({ span }: Props) {
  const { name, kind, spanId, traceId } = span;
  return (
    <article className="rounded-md border bg-card text-card-foreground p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{String(name ?? "(unnamed)")}</h3>
        <section className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{kind != null ? `kind: ${String(kind)}` : ""}</span>
          <Button type="button" variant="outline" size="sm" className="rounded-[6px]"> <Plus className="size-4" /> Add attribute</Button>
        </section>
      </header>
      <section className="mt-1 text-[11px] text-muted-foreground">
        <span className="mr-3">spanId: {spanId ?? "—"}</span>
        <span>traceId: {traceId ?? "—"}</span>
      </section>
      <AttributesTable attributes={span.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} />
    </article>
  );
}


