"use client";

import { useDroppable } from "@dnd-kit/core";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import CanvasBlock from "./_components/CanvasBlock";
import { useDndMonitor } from "@dnd-kit/core";
import { labelToType, groupTitleToSignal, type GroupTitle } from "../../lib/ottl/blockCatalog";
import type { BlockType, SignalType } from "../../lib/ottl/types";

export default function CanvasView() {
  const blocks = usePipelineStore((s) => s.blocks);
  const addBlock = usePipelineStore((s) => s.addBlock);

  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });

  useDndMonitor({
    onDragEnd(event) {
      const data = event.active?.data?.current as { label?: string; groupTitle?: GroupTitle } | undefined;
      if (!data || !data.label || !data.groupTitle) return;
      const mapped = labelToType[data.label] as BlockType | undefined;
      if (!mapped) return;
      const signal = groupTitleToSignal(data.groupTitle) as SignalType | "general";
      const id = `${mapped}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
      addBlock({ id, type: mapped, signal, config: {}, enabled: true });
    },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label="Canvas"
      className={`h-full p-4 ${isOver ? "bg-accent/30" : ""}`}
    >
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Drag blocks here or click from the left panel to add.</p>
      ) : (
        <section className="space-y-3">
          {blocks.map((b, idx) => (
            <CanvasBlock key={b.id} index={idx + 1} type={b.type} signal={b.signal} />
          ))}
        </section>
      )}
    </section>
  );
}


