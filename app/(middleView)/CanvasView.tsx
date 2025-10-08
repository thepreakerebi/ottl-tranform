"use client";

import { useDroppable, DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import CanvasBlock from "./_components/CanvasBlock";
import { useDndMonitor } from "@dnd-kit/core";
import { labelToType, groupTitleToSignal, type GroupTitle } from "../../lib/ottl/blockCatalog";
import { PlusSquare, MinusSquare, Pencil, VenetianMask, GitBranch, Hash, ScanText, Ruler, Sigma, Tags } from "lucide-react";
import type { BlockType, SignalType } from "../../lib/ottl/types";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";

export default function CanvasView() {
  const blocks = usePipelineStore((s) => s.blocks);
  const addBlock = usePipelineStore((s) => s.addBlock);
  const removeBlock = usePipelineStore((s) => s.removeBlock);
  const updateBlock = usePipelineStore((s) => s.updateBlock);
  const reorder = usePipelineStore((s) => s.reorderBlocks);
  const hasTelemetry = useTelemetryStore((s) => !!s.parsed);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = blocks.findIndex((b) => b.id === String(active.id));
        const newIndex = blocks.findIndex((b) => b.id === String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;
        if (oldIndex !== newIndex) reorder(oldIndex, newIndex);
      }}
    >
    <section
      ref={setNodeRef}
      aria-label="Canvas"
      className={`h-full overflow-y-auto overflow-x-hidden p-4 ${isOver ? "bg-accent/30" : ""}`}
    >
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasTelemetry
            ? "Drag blocks here or click from the left panel to add."
            : "Paste telemetry data and drag and drop blocks here or click from the left panel to add."}
        </p>
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <section className="space-y-3">
            {blocks.map((b, idx) => (
              <CanvasBlock
                key={b.id}
                id={b.id}
                index={idx + 1}
                type={b.type}
                signal={b.signal}
                configuredSummary={b.summary}
                initialConfig={b.config}
                icon={iconForType(b.type)}
                onDelete={() => removeBlock(b.id)}
                onDuplicate={() => {
                  const id = `${b.type}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
                  addBlock({ ...b, id });
                }}
                onConfigure={() => updateBlock(b.id, { /* placeholder */ })}
                onApplyConfig={(summary, config) => updateBlock(b.id, { config, summary, errors: undefined })}
              />
            ))}
          </section>
        </SortableContext>
      )}
    </section>
    </DndContext>
  );
}

function iconForType(type: string) {
  switch (type) {
    case "addAttribute":
      return <PlusSquare className="size-4" />;
    case "removeAttribute":
      return <MinusSquare className="size-4" />;
    case "renameAttribute":
      return <Pencil className="size-4" />;
    case "maskAttribute":
      return <VenetianMask className="size-4" />;
    case "editParentChild":
      return <GitBranch className="size-4" />;
    case "editTraceOrSpanId":
      return <Hash className="size-4" />;
    case "renameLogField":
      return <Pencil className="size-4" />;
    case "maskLogField":
      return <ScanText className="size-4" />;
    case "unitConversion":
      return <Ruler className="size-4" />;
    case "aggregateSeries":
      return <Sigma className="size-4" />;
    case "editLabels":
      return <Tags className="size-4" />;
    default:
      return <PlusSquare className="size-4" />;
  }
}


