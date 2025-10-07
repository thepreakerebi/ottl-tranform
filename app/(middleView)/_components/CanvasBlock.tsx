"use client";

import { Copy, Trash2, Settings, GripHorizontal } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { typeToDescription } from "../../../lib/ottl/blockCatalog";

type Props = {
  id: string;
  index?: number;
  type: string;
  signal: string;
  icon?: React.ReactNode;
  configuredSummary?: string; // when configured, show this instead of the tooltip description
  onConfigure?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export default function CanvasBlock({ id, index, type, signal, icon, configuredSummary, onConfigure, onDuplicate, onDelete }: Props) {
  const title = humanizeType(type);
  const description = configuredSummary || typeToDescription[type] || "";
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  } as React.CSSProperties;

  return (
    <article aria-label={title} ref={sortable.setNodeRef} style={style} className="rounded-lg bg-secondary text-secondary-foreground p-4">
      <section className="flex items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Drag to reorder"
          className="cursor-grab active:cursor-grabbing"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripHorizontal />
        </Button>
      </section>
      <section className="flex items-start gap-4">
        <aside className="pt-1">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
            {index ?? 1}
          </span>
        </aside>
        <section className="flex-1">
          <header className="flex items-center justify-between">
            <h4 className="text-base font-semibold flex items-center gap-2">
              {icon}
              {title}
            </h4>
            <section className="flex items-center gap-3">
              <Button type="button" aria-label="Duplicate block" onClick={onDuplicate} variant="ghost" size="icon">
                <Copy />
              </Button>
              <Button type="button" aria-label="Delete block" onClick={onDelete} variant="ghost" size="icon">
                <Trash2 />
              </Button>
            </section>
          </header>
          <p className="mt-4 text-base">{description}</p>
          <section className="mt-4">
            <Button type="button" onClick={onConfigure} variant="outline" className="inline-flex items-center gap-2">
              <Settings className="size-4" /> Configure
            </Button>
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


