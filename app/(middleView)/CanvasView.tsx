"use client";

import { useDroppable } from "@dnd-kit/core";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import CanvasBlock from "./_components/CanvasBlock";

export default function CanvasView() {
  const blocks = usePipelineStore((s) => s.blocks);
  const addBlock = usePipelineStore((s) => s.addBlock);

  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });

  return (
    <section
      ref={setNodeRef}
      aria-label="Canvas"
      className={`h-full p-4 ${isOver ? "bg-accent/30" : ""}`}
    >
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Drag blocks here or click from the left panel to add.</p>
      ) : (
        <section className="space-y-2">
          {blocks.map((b) => (
            <CanvasBlock key={b.id} title={b.type} subtitle={b.signal} />
          ))}
        </section>
      )}
    </section>
  );
}


