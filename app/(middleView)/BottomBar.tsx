"use client";

import { useUIStore } from "../../lib/stores/uiStore";
import { Play, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { CommandDialog, Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "../../components/ui/command";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";
import { usePipelineStore } from "../../lib/stores/pipelineStore";
import { usePreviewStore } from "../../lib/stores/previewStore";
import { runPipeline } from "../../lib/compute/runPipeline";
import { useOttlStore } from "../../lib/stores/ottlStore";
import { parseOttlToBlocks } from "../../lib/ottl/parser";

export default function BottomBar() {
  const active = useUIStore((s) => s.activeMiddleTab);
  const setActive = useUIStore((s) => s.setActiveMiddleTab);
  const [isRunning, setIsRunning] = useState(false);
  const telemetry = useTelemetryStore((s) => s.parsed);
  const blocks = usePipelineStore((s) => s.blocks);
  const setSnapshots = usePreviewStore((s) => s.setSnapshots);
  const setAutoJump = usePreviewStore((s) => s.setAutoJump);
  const ottlText = useOttlStore((s) => s.text);
  const [openCmd, setOpenCmd] = useState(false);
  const parsed = useTelemetryStore((s) => s.parsed);
  const signal = useTelemetryStore((s) => s.signal);
  const attributeItems = collectAttributeItems(parsed, signal);

  function handleRun() {
    if (isRunning) return;
    if (!telemetry) return;
    setIsRunning(true);
    try {
      const useRaw = active === "raw-ottl" && ottlText.trim().length > 0;
      const blocksToRun = useRaw ? parseOttlToBlocks(ottlText) : blocks;
      if (!Array.isArray(blocksToRun) || blocksToRun.length === 0) return;
      const result = runPipeline(telemetry, blocksToRun);
      setSnapshots(result.snapshots);
      setAutoJump(true);
    } finally {
      setIsRunning(false);
    }
  }

  function openSearch() {
    setOpenCmd(true);
  }

  function scrollToAttribute(attrKey: string) {
    try {
      const el = document.querySelector(`[data-attr-key="${CSS.escape(attrKey)}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus?.();
      }
    } catch {}
  }

  return (
    <footer aria-label="View switcher and run" className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
      <section className="pointer-events-auto border rounded-[22px] bg-card text-card-foreground shadow-sm px-4 py-4 flex items-center gap-4">
        <nav aria-label="Views">
          <ul className="flex items-center gap-2">
            <li>
              <Button
                type="button"
                variant={active === "canvas" ? "default" : "ghost"}
                className="rounded-[6px] px-2 py-1"
                onClick={() => setActive("canvas")}
              >
                Canvas
              </Button>
            </li>
            <li>
              <Button
                type="button"
                variant={active === "raw-ottl" ? "default" : "ghost"}
                className="rounded-[6px] px-2 py-1"
                onClick={() => setActive("raw-ottl")}
              >
                Raw OTTL
              </Button>
            </li>
          </ul>
        </nav>
        {active === "canvas" ? (
          <Button type="button" aria-label="Search attributes" variant="secondary" onClick={openSearch} disabled={!parsed} className="rounded-[6px] px-3 py-2 inline-flex items-center gap-2">
            <Search className="size-4" />
            Search attributes
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleRun}
            aria-busy={isRunning}
            aria-label="Run transformation"
            variant="secondary"
            disabled={
              isRunning ||
              !telemetry ||
              (!ottlText || ottlText.trim().length === 0)
            }
            className="rounded-[6px] px-4 py-2 inline-flex items-center gap-2"
          >
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {isRunning ? "Running…" : "Run Transformation"}
          </Button>
        )}
      </section>
      <CommandDialog open={openCmd} onOpenChange={setOpenCmd}>
        <Command>
          <CommandInput placeholder="Search attribute keys…" />
          <CommandList>
            <CommandEmpty>No attributes found.</CommandEmpty>
            {attributeItems.map((group) => (
              <CommandGroup key={group.title} heading={group.title}>
                {group.items.map((it) => (
                  <CommandItem key={`${group.title}-${it.key}`} onSelect={() => { setOpenCmd(false); scrollToAttribute(it.key); }}>
                    {it.key}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </footer>
  );
}

type AttributeKV = { key?: string; value?: Record<string, unknown> };
type TracesDoc = { resourceSpans?: Array<{ resource?: { attributes?: AttributeKV[] }; scopeSpans?: Array<{ scope?: { attributes?: AttributeKV[] }; spans?: Array<{ attributes?: AttributeKV[] }> }> }> };
type LogsDoc = { resourceLogs?: Array<{ resource?: { attributes?: AttributeKV[] }; scopeLogs?: Array<{ scope?: { attributes?: AttributeKV[] }; logRecords?: Array<{ attributes?: AttributeKV[] }> }> }> };
type MetricsDoc = { resourceMetrics?: Array<{ resource?: { attributes?: AttributeKV[] }; scopeMetrics?: Array<{ scope?: { attributes?: AttributeKV[] }; metrics?: Array<{ sum?: { dataPoints?: Array<{ attributes?: AttributeKV[] }> }; gauge?: { dataPoints?: Array<{ attributes?: AttributeKV[] }> }; histogram?: { dataPoints?: Array<{ attributes?: AttributeKV[] }> } }> }> }> };
type Group = { title: string; items: Array<{ key: string }> };

function asArray<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }

function collectAttributeItems(parsed: unknown, signal: string): Group[] {
  if (!parsed) return [];
  const groups: Group[] = [];
  const push = (title: string, attrs: unknown) => {
    const list = asArray<AttributeKV>(attrs).filter((a) => typeof a?.key === "string") as Array<{ key: string }>;
    if (list.length) groups.push({ title, items: list.map((a) => ({ key: a.key })) });
  };
  try {
    if (signal === "traces") {
      const doc = parsed as TracesDoc;
      const rs0 = (doc.resourceSpans && doc.resourceSpans[0]) || undefined;
      if (rs0) {
        push("Resource", rs0.resource?.attributes);
        const scopeSpans = rs0.scopeSpans ?? [];
        for (let i = 0; i < scopeSpans.length; i++) {
          const ss = scopeSpans[i];
          push(`Scope ${i + 1}`, ss.scope?.attributes);
          const spans = ss.spans ?? [];
          for (let j = 0; j < spans.length; j++) push(`Span ${j + 1}`, spans[j].attributes);
        }
      }
    } else if (signal === "logs") {
      const doc = parsed as LogsDoc;
      const rl0 = (doc.resourceLogs && doc.resourceLogs[0]) || undefined;
      if (rl0) {
        push("Resource", rl0.resource?.attributes);
        const scopeLogs = rl0.scopeLogs ?? [];
        for (let i = 0; i < scopeLogs.length; i++) {
          const sl = scopeLogs[i];
          push(`Scope ${i + 1}`, sl.scope?.attributes);
          const records = sl.logRecords ?? [];
          for (let j = 0; j < records.length; j++) push(`Record ${i + 1}.${j + 1}`, records[j].attributes);
        }
      }
    } else if (signal === "metrics") {
      const doc = parsed as MetricsDoc;
      const rm0 = (doc.resourceMetrics && doc.resourceMetrics[0]) || undefined;
      if (rm0) {
        push("Resource", rm0.resource?.attributes);
        const scopeMetrics = rm0.scopeMetrics ?? [];
        for (let i = 0; i < scopeMetrics.length; i++) {
          const sm = scopeMetrics[i];
          push(`Scope ${i + 1}`, sm.scope?.attributes);
          const metrics = sm.metrics ?? [];
          for (let mi = 0; mi < metrics.length; mi++) {
            const m = metrics[mi];
            const dps = (m.sum?.dataPoints ?? m.gauge?.dataPoints ?? m.histogram?.dataPoints) ?? [];
            for (let di = 0; di < dps.length; di++) push(`Datapoint ${i + 1}.${mi + 1}.${di + 1}`, dps[di].attributes);
          }
        }
      }
    }
  } catch {}
  return groups;
}


