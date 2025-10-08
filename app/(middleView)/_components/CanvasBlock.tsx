"use client";

import { Copy, Trash2, Settings, GripHorizontal } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { typeToDescription } from "../../../lib/ottl/blockCatalog";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import AddAttributeBlockConfiguration from "./AddAttributeBlockConfiguration";
import { useTelemetryStore } from "../../../lib/stores/telemetryStore";
import { useState } from "react";

type Props = {
  id: string;
  index?: number;
  type: string;
  signal: string;
  icon?: React.ReactNode;
  configuredSummary?: string; // when configured, show this instead of the tooltip description
  onConfigure?: () => void;
  onApplyConfig?: (summary: string, config: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export default function CanvasBlock({ id, index, type, icon, configuredSummary, onConfigure, onApplyConfig, onDuplicate, onDelete }: Props) {
  const title = humanizeType(type);
  const description = configuredSummary || typeToDescription[type] || "";
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  } as React.CSSProperties;
  const [open, setOpen] = useState(false);
  const detectedSignal = useTelemetryStore((s) => s.signal);

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
            {type === "addAttribute" ? (
              <Popover open={open} onOpenChange={(newOpen) => {
                // Only allow closing, not opening via onOpenChange
                if (!newOpen) {
                  // Don't close automatically - only allow manual close via buttons
                  return;
                }
                setOpen(newOpen);
              }}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="inline-flex items-center gap-2" onClick={() => setOpen(true)}>
                    <Settings className="size-4" /> Configure
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[300px]">
                  <AddAttributeBlockConfiguration
                    signal={normalizeSignal(detectedSignal)}
                    description={typeToDescription[type] || ""}
                    onApply={(summary, config) => {
                      onApplyConfig?.(summary, config);
                      setOpen(false);
                    }}
                    onCancel={() => setOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Button type="button" onClick={onConfigure} variant="outline" className="inline-flex items-center gap-2">
                <Settings className="size-4" /> Configure
              </Button>
            )}
          </section>
        </section>
      </section>
    </article>
  );
}

function normalizeSignal(signal: string): "traces" | "logs" | "metrics" | "general" | "unknown" {
  if (signal === "traces" || signal === "logs" || signal === "metrics" || signal === "general" || signal === "unknown") return signal;
  return "unknown";
}

function humanizeType(type: string) {
  return (
    type
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}


