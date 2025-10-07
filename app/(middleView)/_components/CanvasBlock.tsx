"use client";

import { Copy, Trash2, PlusSquare, Settings } from "lucide-react";
import { typeToDescription } from "../../../lib/ottl/blockCatalog";

type Props = {
  index?: number;
  type: string;
  signal: string;
  configuredSummary?: string; // when configured, show this instead of the tooltip description
  onConfigure?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export default function CanvasBlock({ index, type, signal, configuredSummary, onConfigure, onDuplicate, onDelete }: Props) {
  const title = humanizeType(type);
  const description = configuredSummary || typeToDescription[type] || "";

  return (
    <article aria-label={title} className="rounded-lg bg-secondary text-secondary-foreground p-4">
      <section className="flex items-start gap-4">
        <aside className="pt-1">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
            {index ?? 1}
          </span>
        </aside>
        <section className="flex-1">
          <header className="flex items-center justify-between">
            <h4 className="text-base font-semibold flex items-center gap-2">
              <PlusSquare className="size-4" /> {title}
            </h4>
            <section className="flex items-center gap-3">
              <button type="button" aria-label="Duplicate block" onClick={onDuplicate} className="rounded p-1 hover:bg-accent focus:bg-accent">
                <Copy className="size-4" />
              </button>
              <button type="button" aria-label="Delete block" onClick={onDelete} className="rounded p-1 hover:bg-accent focus:bg-accent">
                <Trash2 className="size-4" />
              </button>
            </section>
          </header>
          <p className="mt-4 text-base">{description}</p>
          <section className="mt-4">
            <button type="button" onClick={onConfigure} className="inline-flex items-center gap-2 rounded border px-3 py-2">
              <Settings className="size-4" /> Configure
            </button>
          </section>
        </section>
      </section>
    </article>
  );
}

function humanizeType(type: string) {
  return (
    type
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}


