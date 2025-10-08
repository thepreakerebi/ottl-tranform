"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePreviewStore } from "../../lib/stores/previewStore";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { ArrowDown, Copy } from "lucide-react";
import { toast } from "sonner";

export default function RightPanel() {
  const snapshots = usePreviewStore((s) => s.snapshots);
  const stepIndex = usePreviewStore((s) => s.stepIndex);
  const setStepIndex = usePreviewStore((s) => s.setStepIndex);
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
  const afterHighlights = useMemo(() => computeHighlights(beforeStr, afterStr), [beforeStr, afterStr]);
  const firstChanged = useMemo(() => (afterHighlights.size ? Math.min(...Array.from(afterHighlights)) : null), [afterHighlights]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

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
            {/* Fixed output header */}
            <div className="px-4 py-2 border-b text-xs font-medium flex items-center justify-between flex-shrink-0 bg-muted/50">
              <section className="flex items-center gap-1">
                <span>Output</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Jump to first change"
                  disabled={firstChanged === null}
                  onClick={() => {
                    if (firstChanged === null) return;
                    const el = contentRef.current?.querySelector(`[data-line="${firstChanged}"]`) as HTMLElement | null;
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
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
              <span className="text-muted-foreground">{options[stepIndex]?.label}</span>
            </div>
            {/* Scrollable JSON content */}
            <div className="flex-1 min-h-0 overflow-auto" ref={contentRef}>
              <div className="p-4">
                {renderHighlighted(afterStr, afterHighlights)}
              </div>
            </div>
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
  const beforeSet = new Set(beforeText.split("\n"));
  const highlights = new Set<number>();
  const lines = afterText.split("\n");
  lines.forEach((line, idx) => {
    if (!beforeSet.has(line)) {
      highlights.add(idx);
    }
  });
  return highlights;
}

function renderHighlighted(text: string, highlights: Set<number>) {
  const lines = text.split("\n");
  return (
    <section>
      {lines.map((ln, i) => (
        <div key={i} data-line={i} className={`text-xs leading-5 font-mono whitespace-pre ${highlights.has(i) ? "bg-green-400" : ""}`}>{ln || "\u00A0"}</div>
      ))}
    </section>
  );
}