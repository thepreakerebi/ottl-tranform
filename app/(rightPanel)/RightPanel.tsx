"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePreviewStore } from "../../lib/stores/previewStore";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { ArrowDown, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { toast } from "sonner";

export default function RightPanel() {
  const snapshots = usePreviewStore((s) => s.snapshots);
  const stepIndex = usePreviewStore((s) => s.stepIndex);
  const setStepIndex = usePreviewStore((s) => s.setStepIndex);
  const shouldAutoJump = usePreviewStore((s) => s.shouldAutoJump);
  const setAutoJump = usePreviewStore((s) => s.setAutoJump);
  const blocks = usePipelineStore((s) => s.blocks);

  const options = useMemo(() => {
    return snapshots.map((s) => {
      const label = blockLabel(blocks[s.stepIndex]?.type ?? "", s.stepIndex);
      return { value: String(s.stepIndex), label };
    });
  }, [snapshots, blocks]);

  const current = snapshots[stepIndex];
  const beforeStr = useMemo(() => pretty(current?.before), [current]);
  const afterStr = useMemo(() => pretty(current?.after), [current]);
  const diffHighlights = useMemo(() => computeHighlights(beforeStr, afterStr), [beforeStr, afterStr]);
  const unionForClusters = useMemo(() => {
    const u = new Set<number>();
    diffHighlights.added.forEach((i) => u.add(i));
    diffHighlights.removed.forEach((i) => u.add(i));
    return u;
  }, [diffHighlights]);
  const highlightList = useMemo(() => clusterHighlights(unionForClusters), [unionForClusters]);
  const [jumpIndex, setJumpIndex] = useState(0);
  // firstChanged retained conceptually; header button logic uses highlightList directly
  const contentRef = useRef<HTMLDivElement | null>(null);
  const beforeContentRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [beforeExpanded, setBeforeExpanded] = useState(true);

  // Shared function to jump to transformation points in both sections
  const jumpToTransformationPoint = () => {
    if (highlightList.length === 0) return;
    const target = highlightList[jumpIndex] ?? highlightList[0];
    
    // Jump in After section
    const afterEl = contentRef.current?.querySelector(`[data-line="${target}"]`) as HTMLElement | null;
    afterEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Jump in Before section (if expanded)
    if (beforeExpanded && beforeContentRef.current) {
      const beforeEl = beforeContentRef.current.querySelector(`[data-line="${target}"]`) as HTMLElement | null;
      beforeEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    setJumpIndex((i) => (i + 1) % highlightList.length);
  };

  // After a run, auto-jump to the first change cluster once in both sections
  useEffect(() => {
    if (!shouldAutoJump || highlightList.length === 0) return;
    const target = highlightList[0];
    
    // Auto-jump in After section
    const afterEl = contentRef.current?.querySelector(`[data-line="${target}"]`) as HTMLElement | null;
    afterEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Auto-jump in Before section (if expanded)
    if (beforeExpanded && beforeContentRef.current) {
      const beforeEl = beforeContentRef.current.querySelector(`[data-line="${target}"]`) as HTMLElement | null;
      beforeEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    setAutoJump(false);
  // We intentionally depend only on shouldAutoJump + list length so the deps array size is stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoJump, highlightList.length, beforeExpanded]);

  // When new snapshots arrive (e.g., after Run), default to the last step.
  useEffect(() => {
    if (snapshots.length === 0) return;
    const last = snapshots.length - 1;
    if (stepIndex !== last) setStepIndex(last);
  }, [snapshots.length, stepIndex, setStepIndex]);

  return (
    <aside aria-label="Preview panel" className="h-full border-l overflow-hidden flex flex-col">
      {/* Fixed header - never scrolls */}
      <header className="flex items-center justify-between gap-3 p-4 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold">Preview</h2>
        {snapshots.length > 0 && (
          <nav aria-label="Step selector">
            <Select value={String(stepIndex)} onValueChange={(v) => setStepIndex(Number(v))}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder="Select step" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </nav>
        )}
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {snapshots.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Run the transformation to see the preview here.
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Fixed After header */}
            <div className="px-4 py-2 border-b text-xs font-medium flex items-center justify-between flex-shrink-0 bg-muted/50">
              <section className="flex items-center gap-1">
                <span>After</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Jump to first change"
                  disabled={highlightList.length === 0}
                  onClick={jumpToTransformationPoint}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Copy output"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(afterStr);
                      setCopied(true);
                      toast.success("Output copied to clipboard");
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                {copied && (
                  <span role="status" aria-live="polite" className="text-[11px] text-green-600 ml-1">Copied!</span>
                )}
              </section>
              <span className="text-muted-foreground">{options[stepIndex]?.label}{highlightList.length ? ` • ${highlightList.length} change${highlightList.length>1?"s":""}` : ""}</span>
            </div>
            {/* After section - takes half the remaining height */}
            <div className="flex-1 min-h-0 overflow-auto" ref={contentRef} onScrollCapture={() => { if (shouldAutoJump) setAutoJump(false); }}>
              <div className="p-4">
                <TooltipProvider>
                  {renderHighlighted(afterStr, diffHighlights)}
                </TooltipProvider>
              </div>
            </div>
            
            {/* Before section header */}
            <div className="px-4 py-2 border-t border-b text-xs font-medium flex items-center justify-between flex-shrink-0 bg-muted/50">
              <section className="flex items-center gap-1">
                <span>Before</span>
                {beforeExpanded && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Jump to first change"
                    disabled={highlightList.length === 0}
                    onClick={jumpToTransformationPoint}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                )}
              </section>
              <button
                type="button"
                aria-expanded={beforeExpanded}
                onClick={() => setBeforeExpanded((v) => !v)}
                className="rounded px-2 py-1 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                {beforeExpanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                <span className="sr-only">Toggle before section</span>
              </button>
            </div>
            
            {/* Before section - takes the other half of the remaining height when expanded */}
            {beforeExpanded && (
              <div className="flex-1 min-h-0 overflow-auto" ref={beforeContentRef}>
                <div className="p-4">
                  {renderPlainWithLineNumbers(beforeStr)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function blockLabel(type: string, idx: number) {
  const title = humanizeType(type || "Step");
  return `Step ${idx + 1}: ${title}`;
}

function humanizeType(type: string) {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function pretty(v: unknown) {
  if (v == null) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function computeHighlights(beforeText: string, afterText: string) {
  const beforeLines = beforeText.split("\n");
  const afterLines = afterText.split("\n");
  const beforeSet = new Set(beforeLines);
  const added = new Set<number>();
  const removed = new Set<number>();
  const removedMap = new Map<number, string>();
  // Added lines = those present in after but not in before
  afterLines.forEach((line, idx) => {
    if (!beforeSet.has(line)) added.add(idx);
  });
  // Removed lines = those present in before but not in after; we approximate positions by best-effort mapping index
  const afterSet = new Set(afterLines);
  beforeLines.forEach((line, idx) => {
    if (!afterSet.has(line)) removed.add(Math.min(idx, afterLines.length - 1));
    if (!afterSet.has(line)) removedMap.set(Math.min(idx, afterLines.length - 1), line);
  });
  return { added, removed, removedMap };
}

function renderHighlighted(text: string, highlights: { added: Set<number>; removed: Set<number>; removedMap?: Map<number, string> }) {
  const lines = text.split("\n");
  return (
    <section>
      {lines.map((ln, i) => (
        highlights.removed.has(i) ? (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                data-line={i}
                tabIndex={0}
                className={`text-xs leading-5 font-mono whitespace-pre bg-red-300 outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                {ln || "\u00A0"}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs">Previously: {highlights.removedMap?.get(i) ?? "(unknown)"}</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div key={i} data-line={i} className={`text-xs leading-5 font-mono whitespace-pre ${highlights.added.has(i) ? "bg-green-400" : ""}`}>{ln || "\u00A0"}</div>
        )
      ))}
    </section>
  );
}

function renderPlain(text: string) {
  const lines = text.split("\n");
  return (
    <section>
      {lines.map((ln, i) => (
        <div key={i} className="text-xs leading-5 font-mono whitespace-pre">{ln || "\u00A0"}</div>
      ))}
    </section>
  );
}

function renderPlainWithLineNumbers(text: string) {
  const lines = text.split("\n");
  return (
    <section>
      {lines.map((ln, i) => (
        <div key={i} data-line={i} className="text-xs leading-5 font-mono whitespace-pre">{ln || "\u00A0"}</div>
      ))}
    </section>
  );
}

function clusterHighlights(highlights: Set<number>): number[] {
  const sorted = Array.from(highlights).sort((a, b) => a - b);
  const clusters: number[] = [];
  let prev: number | null = null;
  for (const idx of sorted) {
    if (prev === null || idx > prev + 1) {
      clusters.push(idx);
    }
    prev = idx;
  }
  return clusters;
}