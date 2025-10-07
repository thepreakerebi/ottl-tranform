"use client";
import { useState } from "react";
import PanelBlock from "./_components/PanelBlock";
import { ChevronDown, ChevronUp, PlusSquare, MinusSquare, Pencil, VenetianMask, GitBranch, Hash, ScanText, Ruler, Sigma, Tags } from "lucide-react";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import type { Block } from "../../lib/ottl/types";
import { labelToType, groupTitleToSignal } from "../../lib/ottl/blockCatalog";

type BlockGroup = {
  title: string;
  items: Array<{ name: string; description: string; icon: React.ReactNode }>
};

const groups: BlockGroup[] = [
  {
    title: "General",
    items: [
      { name: "Add attribute", description: "Add or upsert an attribute.", icon: <PlusSquare className="size-4" /> },
      { name: "Remove attribute", description: "Remove one or more attributes.", icon: <MinusSquare className="size-4" /> },
      { name: "Rename attribute", description: "Rename an attribute key.", icon: <Pencil className="size-4" /> },
      { name: "Mask attribute", description: "Mask an attribute value.", icon: <VenetianMask className="size-4" /> },
    ],
  },
  {
    title: "Traces",
    items: [
      { name: "Edit parent/child", description: "Change span parent/child relations.", icon: <GitBranch className="size-4" /> },
      { name: "Edit trace/span ID", description: "Modify or randomize IDs.", icon: <Hash className="size-4" /> },
    ],
  },
  {
    title: "Logs",
    items: [
      { name: "Rename field", description: "Rename a log field.", icon: <Pencil className="size-4" /> },
      { name: "Mask field", description: "Mask a log field.", icon: <ScanText className="size-4" /> },
    ],
  },
  {
    title: "Metrics",
    items: [
      { name: "Unit conversion", description: "Convert metric units.", icon: <Ruler className="size-4" /> },
      { name: "Aggregate series", description: "Aggregate datapoints.", icon: <Sigma className="size-4" /> },
      { name: "Edit labels", description: "Rename, remove or change labels.", icon: <Tags className="size-4" /> },
    ],
  },
];

export default function PanelBlocksSection() {
  const [expanded, setExpanded] = useState(true);
  const addBlock = usePipelineStore((s) => s.addBlock);

  function createBlock(type: string, groupTitle: string): Block {
    const id = `${type}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
    const signal = groupTitleToSignal(groupTitle) as Block["signal"];
    return {
      id,
      type: type as Block["type"],
      signal,
      config: {},
      enabled: true,
    };
  }

  function onSelectBlock(name: string, groupTitle: string) {
    const type = labelToType[name];
    if (!type) return;
    const block = createBlock(type, groupTitle);
    addBlock(block);
  }

  return (
    <section aria-label="Transformation blocks" className="border-t overflow-auto" style={{ maxHeight: "50vh" }}>
      <header className="sticky top-0 z-10 bg-background flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-semibold">Transformation blocks</h2>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="rounded px-2 py-1 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          <span className="sr-only">Toggle blocks</span>
        </button>
      </header>
      {expanded && (
        <section className="p-4 space-y-6">
          <p className="text-xs text-muted-foreground">Click to add to canvas or drag and drop on canvas</p>
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">{g.title}</h3>
              <ul className="space-y-1">
                {g.items.map((b) => (
                  <PanelBlock
                    key={b.name}
                    icon={b.icon}
                    name={b.name}
                    description={b.description}
                    groupTitle={g.title}
                    onSelect={() => onSelectBlock(b.name, g.title)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}
    </section>
  );
}


