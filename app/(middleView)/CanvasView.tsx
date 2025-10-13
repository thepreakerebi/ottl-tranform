"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";
import AttributesTable from "./_components/AttributesTable";
import Collapsible from "./_components/Collapsible";
import AddAttributeDialog from "./_components/AddAttributeDialog";
import { Button } from "../../components/ui/button";

// Minimal OTLP view models (read-only)
type AttributeKV = { key: string; value: Record<string, unknown> };

// Traces
type SpanView = { name?: string; kind?: number | string; spanId?: string; traceId?: string; attributes?: AttributeKV[] };
type ScopeSpansView = { scope?: { attributes?: AttributeKV[] }; spans?: SpanView[] };
type ResourceSpansView = { scopeSpans?: ScopeSpansView[] };
type TracesDocView = { resourceSpans?: ResourceSpansView[] };

// Logs
type LogRecordView = { timeUnixNano?: string; severityText?: string; body?: Record<string, unknown> | string; attributes?: AttributeKV[] };
type ScopeLogsView = { logRecords?: LogRecordView[] };
type ResourceLogsView = { scopeLogs?: ScopeLogsView[] };
type LogsDocView = { resourceLogs?: ResourceLogsView[] };

// Metrics
type DataPointView = { attributes?: AttributeKV[]; timeUnixNano?: string; value?: number | string };
type MetricView = { name?: string; description?: string; unit?: string; sum?: { dataPoints?: DataPointView[] }; gauge?: { dataPoints?: DataPointView[] }; histogram?: { dataPoints?: DataPointView[] } };
type ScopeMetricsView = { metrics?: MetricView[] };
type ResourceMetricsView = { scopeMetrics?: ScopeMetricsView[] };
type MetricsDocView = { resourceMetrics?: ResourceMetricsView[] };

export default function CanvasView() {
  const parsed = useTelemetryStore((s) => s.parsed);
  const setParsed = useTelemetryStore((s) => s.setParsed);
  const signal = useTelemetryStore((s) => s.signal);

  // Logs view mode: grouped by scope (default) or flat list
  const [logsView, setLogsView] = useState<"grouped" | "flat">("grouped");
  // Add attribute modal
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ title: string; path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] } } | null>(null);

  const openAdd = (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => {
    setAddTarget({ title, path });
    setAddOpen(true);
  };

  const content = useMemo(() => renderBySignal(parsed, signal, { logsView, setLogsView, openAdd }), [parsed, signal, logsView]);

  const locationTabs = useMemo(() => computeLocationTabs(parsed, signal, { logsView }), [parsed, signal, logsView]);

  function scrollToAnchor(id: string) {
    try {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  }

  return (
    <section className="h-full overflow-hidden">
      <section className="flex h-full gap-0">
        {parsed ? (
          <aside aria-label="Locations" className="w-[100px] py-4 shrink-0 border-r bg-card text-card-foreground">
            <nav aria-label="Location sections">
              <ul className="flex flex-col gap-2">
                {locationTabs.map((t) => (
                  <li key={t.id}>
                    <Button type="button" variant="ghost" className="w-full justify-start overflow-hidden" onClick={() => scrollToAnchor(t.id)} aria-controls={t.id}>
                      <span className="truncate">{t.label}</span>
                    </Button>
                  </li>
                ))}
                {locationTabs.length === 0 && (
                  <li>
                    <span className="text-xs text-muted-foreground">No locations</span>
                  </li>
                )}
              </ul>
            </nav>
          </aside>
        ) : null}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4" aria-label="Canvas content">
          {content}
        </main>
      </section>
      <AddAttributeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        targetTitle={addTarget?.title ?? ""}
        onSubmit={(payload) => {
          try {
            if (!addTarget) return;
            function computeValueFromContext(): string {
              if (payload.mode === "literal") {
                if (payload.literalType === "number") return String(Number(payload.value ?? ""));
                if (payload.literalType === "boolean") return (payload.value ?? "").toLowerCase() === "true" ? "true" : "false";
                return String(payload.value ?? "");
              }
              const sourceKey = String(payload.sourceAttr ?? "");
              const start = payload.substringStart ?? 0;
              const end = payload.substringEnd ?? null;
              const readAttr = (arr: unknown[] | undefined) => {
                const list = Array.isArray(arr) ? arr as Array<{ key?: string; value?: Record<string, unknown> }> : [];
                const kv = list.find((k) => k && typeof k === "object" && k.key === sourceKey);
                const sv = kv?.value?.stringValue as string | undefined;
                return sv ?? "";
              };
              // Cross-context lookup: try resource, then scope, then entity-level attributes
              let source = "";
              if (signal === "traces") {
                const doc = parsed as unknown as TracesDocView;
                const rss = asArray<ResourceSpansView>(doc.resourceSpans);
                const rs0 = rss[0];
                source = source || readAttr((rs0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                const scopeSpans = (rs0 as unknown as { scopeSpans?: ScopeSpansView[] }).scopeSpans ?? [];
                for (const ss of scopeSpans) {
                  source = source || readAttr((ss as unknown as { scope?: { attributes?: AttributeKV[] } }).scope?.attributes as unknown[] | undefined);
                  const spans = (ss as unknown as { spans?: SpanView[] }).spans ?? [];
                  for (const sp of spans) { if (source) break; source = source || readAttr(sp.attributes as unknown[] | undefined); }
                  if (source) break;
                }
              } else if (signal === "logs") {
                const doc = parsed as unknown as LogsDocView;
                const rls = asArray<ResourceLogsView>(doc.resourceLogs);
                const rl0 = rls[0];
                source = source || readAttr((rl0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                const scopeLogs = (rl0 as unknown as { scopeLogs?: ScopeLogsView[] }).scopeLogs ?? [];
                for (const sl of scopeLogs) {
                  source = source || readAttr((sl as unknown as { scope?: { attributes?: AttributeKV[] } }).scope?.attributes as unknown[] | undefined);
                  const records = (sl as unknown as { logRecords?: LogRecordView[] }).logRecords ?? [];
                  for (const lr of records) { if (source) break; source = source || readAttr(lr.attributes as unknown[] | undefined); }
                  if (source) break;
                }
              } else if (signal === "metrics") {
                const doc = parsed as unknown as MetricsDocView;
                const rms = asArray<ResourceMetricsView>(doc.resourceMetrics);
                const rm0 = rms[0];
                source = source || readAttr((rm0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                const scopeMetrics = (rm0 as unknown as { scopeMetrics?: ScopeMetricsView[] }).scopeMetrics ?? [];
                for (const sm of scopeMetrics) {
                  source = source || readAttr((sm as unknown as { scope?: { attributes?: AttributeKV[] } }).scope?.attributes as unknown[] | undefined);
                  const metrics = (sm as unknown as { metrics?: MetricView[] }).metrics ?? [];
                  for (const m of metrics) {
                    if (source) break;
                    const dps = metricDatapointsOf(m);
                    for (const dp of dps) { if (source) break; source = source || readAttr(dp.attributes as unknown[] | undefined); }
                  }
                  if (source) break;
                }
              }
              const slice = end == null ? source.slice(start) : source.slice(start, end);
              return slice;
            }

            const finalString = computeValueFromContext();
            const vobj = { stringValue: finalString } as Record<string, unknown>;
            const kv = { key: payload.key, value: vobj } as { key: string; value: Record<string, unknown> };
            type KV = { key: string; value: Record<string, unknown> };
            const policy = payload.collision ?? "upsert";
            const insertWithPolicy = (arr: KV[] | undefined): KV[] => {
              const list = Array.isArray(arr) ? arr as KV[] : [];
              // If an identical key/value pair exists, do nothing
              if (list.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) return list;
              const existingIndex = list.findIndex((a) => a.key === kv.key);
              if (policy === "upsert") {
                if (existingIndex >= 0) {
                  list[existingIndex] = kv;
                  return list;
                }
                list.push(kv);
                return list;
              }
              // skip and onlyIfMissing behave the same: insert only when key is missing
              if (existingIndex === -1) list.push(kv);
              return list;
            };
            const cloned = parsed ? (JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>) : undefined;
            if (!cloned) return;

            const asRec = (v: unknown): Record<string, unknown> | undefined => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);
            const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

            const currentTarget = addTarget!;
            const kind = currentTarget.path.kind;
            const idx = currentTarget.path.indexPath ?? [];

            if (signal === "traces") {
              const rss = asArr(cloned["resourceSpans"]);
              const rs0 = asRec(rss[0]);
              if (kind === "resource") {
                const res = asRec(rs0?.["resource"]);
                const resObj = res as unknown as { attributes?: KV[] };
                resObj.attributes = insertWithPolicy(resObj.attributes);
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeSpans = asArr(rs0?.["scopeSpans"]);
                const ss = asRec(scopeSpans[i]);
                const scope = asRec(ss?.["scope"]);
                const scObj = scope as unknown as { attributes?: KV[] };
                scObj.attributes = insertWithPolicy(scObj.attributes);
              } else if (kind === "span") {
                // indexPath: [scopeIndex?, spanIndex]
                const scopeIndex = idx.length === 2 ? idx[0] : 0;
                const spanIndex = idx.length === 2 ? idx[1] : idx[0] ?? 0;
                const scopeSpans = asArr(rs0?.["scopeSpans"]);
                const ss = asRec(scopeSpans[scopeIndex]);
                const spans = asArr(ss?.["spans"]);
                const sp = asRec(spans[spanIndex]);
                const spObj = sp as unknown as { attributes?: KV[] };
                spObj.attributes = insertWithPolicy(spObj.attributes);
              }
            } else if (signal === "logs") {
              const rls = asArr(cloned["resourceLogs"]);
              const rl0 = asRec(rls[0]);
              if (kind === "resource") {
                const res = asRec(rl0?.["resource"]);
                const resObj = res as unknown as { attributes?: KV[] };
                resObj.attributes = insertWithPolicy(resObj.attributes);
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeLogs = asArr(rl0?.["scopeLogs"]);
                const sl = asRec(scopeLogs[i]);
                const scope = asRec(sl?.["scope"]);
                const scObj = scope as unknown as { attributes?: KV[] };
                scObj.attributes = insertWithPolicy(scObj.attributes);
              } else if (kind === "log") {
                const i = idx[0] ?? 0; const j = idx[1] ?? 0;
                const scopeLogs = asArr(rl0?.["scopeLogs"]);
                const sl = asRec(scopeLogs[i]);
                const logRecords = asArr(sl?.["logRecords"]);
                const lr = asRec(logRecords[j]);
                const lrObj = lr as unknown as { attributes?: KV[] };
                lrObj.attributes = insertWithPolicy(lrObj.attributes);
              }
            } else if (signal === "metrics") {
              const rms = asArr(cloned["resourceMetrics"]);
              const rm0 = asRec(rms[0]);
              if (kind === "resource") {
                const res = asRec(rm0?.["resource"]);
                const resObj = res as unknown as { attributes?: KV[] };
                resObj.attributes = insertWithPolicy(resObj.attributes);
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeMetrics = asArr(rm0?.["scopeMetrics"]);
                const sm = asRec(scopeMetrics[i]);
                const scope = asRec(sm?.["scope"]);
                const scObj = scope as unknown as { attributes?: KV[] };
                scObj.attributes = insertWithPolicy(scObj.attributes);
              } else if (kind === "datapoint") {
                const i = idx[0] ?? 0; const mi = idx[1] ?? 0; const di = idx[2] ?? 0;
                const scopeMetrics = asArr(rm0?.["scopeMetrics"]);
                const sm = asRec(scopeMetrics[i]);
                const metrics = asArr(sm?.["metrics"]);
                const metric = asRec(metrics[mi]);
                const sum = asRec(metric?.["sum"]);
                const gauge = asRec(metric?.["gauge"]);
                const histogram = asRec(metric?.["histogram"]);
                const dps = asArr(sum?.["dataPoints"] ?? gauge?.["dataPoints"] ?? histogram?.["dataPoints"]);
                const dp = asRec(dps[di]);
                const dpObj = dp as unknown as { attributes?: KV[] };
                dpObj.attributes = insertWithPolicy(dpObj.attributes);
              }
            }
            // Capture the before state BEFORE updating parsed (deep clone to avoid reference issues)
            const beforeVal = structuredClone(parsed) as unknown as import("../../lib/ottl/types").JSONValue;
            const afterVal = structuredClone(cloned) as unknown as import("../../lib/ottl/types").JSONValue;
            
            setParsed(cloned as unknown as import("../../lib/ottl/types").JSONValue);
            
            // Push a lightweight snapshot so RightPanel shows an After diff
            import("../../lib/stores/previewStore").then((mod) => {
              const previews = mod.usePreviewStore.getState();
              const nextStep = previews.snapshots.length;
              previews.setSnapshots([...previews.snapshots, { stepIndex: nextStep, before: beforeVal, after: afterVal }]);
              previews.setStepIndex(nextStep);
              previews.setAutoJump(true);
            }).catch(() => {});

            // Also append an OTTL equivalent to the Raw OTTL editor for visibility
            import("../../lib/stores/ottlStore").then((mod) => {
              const { text, setText } = mod.useOttlStore.getState() as { text: string; setText: (t: string)=>void };

              const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
              const valueExpr = (() => {
                if (payload.mode === "literal") {
                  if (payload.literalType === "number") return String(Number(payload.value ?? 0));
                  if (payload.literalType === "boolean") return (payload.value ?? "").toLowerCase() === "true" ? "true" : "false";
                  return quote(String(payload.value ?? ""));
                }
                const start = payload.substringStart ?? 0;
                const end = payload.substringEnd != null ? `, ${payload.substringEnd}` : "";
                return `Substring(attributes[${quote(String(payload.sourceAttr ?? ""))}], ${start}${end})`;
              })();

              const pathExpr = (() => {
                if (signal === "traces") {
                  if (addTarget!.path.kind === "resource") return `resource.attributes[${quote(payload.key)}]`;
                  if (addTarget!.path.kind === "span") return `span.attributes[${quote(payload.key)}]`;
                  return `scope.attributes[${quote(payload.key)}]`;
                }
                if (signal === "logs") {
                  if (addTarget!.path.kind === "resource") return `resource.attributes[${quote(payload.key)}]`;
                  return `attributes[${quote(payload.key)}]`;
                }
                // metrics
                if (addTarget!.path.kind === "resource" || addTarget!.path.kind === "scope") return `${addTarget!.path.kind === "resource" ? "resource" : "scope"}.attributes[${quote(payload.key)}]`;
                return `attributes[${quote(payload.key)}]`;
              })();

              const stmt = `set(${pathExpr}, ${valueExpr})`;
              const header = `# auto: ${signal} ${addTarget!.path.kind}`;
              const next = [text, header, stmt].filter(Boolean).join("\n").trim();
              setText(next);
            }).catch(() => {});
          } catch {}
        }}
      />
    </section>
  );
}

function renderBySignal(
  parsed: unknown,
  signal: string,
  opts?: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void; openAdd: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void }
) {
  if (!parsed) {
    return <p className="text-sm text-muted-foreground">Paste telemetry data to begin.</p>;
  }
  if (signal === "traces") return renderTraces(parsed as TracesDocView, opts!);
  if (signal === "logs") return renderLogs(parsed as LogsDocView, opts!);
  if (signal === "metrics") return renderMetrics(parsed as MetricsDocView, opts!);
  return <p className="text-sm text-muted-foreground">Unsupported telemetry format.</p>;
}

function renderTraces(doc: TracesDocView, opts: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void; openAdd: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void }) {
  const rss = asArray<ResourceSpansView>(doc.resourceSpans);
  if (rss.length === 0) return <p className="text-sm text-muted-foreground">No trace content.</p>;

  const sections: ReactNode[] = [];
  // Resource (only if attributes exist)
  const resourceAttrs = (rss[0] as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes;
  if (Array.isArray(resourceAttrs) && resourceAttrs.length > 0) {
    sections.push(
      <section id="loc-resource" key="loc-resource">
        <Collapsible key="resource" title="Resource">
          <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
        </Collapsible>
      </section>
    );
  }

  // View switcher for traces (grouped scopes vs flat spans)
  sections.push(
    <section key="trace-view" className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View:</span>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "grouped" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("grouped")}>Grouped</button>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "flat" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("flat")}>Flat</button>
    </section>
  );

  const scopeSpansAll = rss.flatMap((rs) => asArray<ScopeSpansView>(rs.scopeSpans));

  if (opts.logsView === "grouped") {
    const scopesWithAttrsOrSpans = scopeSpansAll.filter((ss) => (Array.isArray(ss.scope?.attributes) && (ss.scope?.attributes?.length ?? 0) > 0) || (Array.isArray(ss.spans) && ss.spans.length > 0));
    if (scopesWithAttrsOrSpans.length > 0) {
      sections.push(
        <section id="loc-scopes" key="loc-scopes">
          <Collapsible key="scopes" title="Scopes" defaultOpen>
            <section className="space-y-3">
              {scopesWithAttrsOrSpans.map((ss, i) => (
                <section id={`loc-scope-${i + 1}`} key={`loc-scope-${i + 1}`}>
                  <Collapsible title={`Scope ${i + 1}`} defaultOpen>
                    {Array.isArray(ss.scope?.attributes) && ss.scope!.attributes!.length > 0 && (
                      <AttributesTable attributes={ss.scope?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope ${i + 1}`, { kind: "scope", indexPath: [i] })} />
                    )}
                    {Array.isArray(ss.spans) && ss.spans.length > 0 && renderSpans(ss.spans, opts.openAdd, i)}
                  </Collapsible>
                </section>
              ))}
            </section>
          </Collapsible>
        </section>
      );
    }
  } else {
    // Flat list of spans across scopes
    const spansAll = scopeSpansAll.flatMap((ss) => asArray<SpanView>(ss.spans));
    const spansElement = renderSpans(spansAll, opts.openAdd);
    if (spansElement) sections.push(
      <section key="loc-spans" id="loc-spans">
        {spansElement}
      </section>
    );
  }

  return <section className="space-y-3">{sections}</section>;
}

function renderSpans(spans: SpanView[], openAdd?: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void, scopeIndex?: number) {
  if (!spans.length) return null;
  const scopeKey = scopeIndex != null ? String(scopeIndex) : "flat";
  return (
    <Collapsible title="Spans" defaultOpen>
          <section className="space-y-3">
        {spans.map((sp, idx) => (
          <section id={`loc-span-${scopeKey}-${idx}`} key={`loc-span-${scopeKey}-${idx}`}>
            <Collapsible title={sp.name ?? `Span ${idx + 1}`} subtitle={sp.spanId ? `spanId: ${sp.spanId}` : undefined}>
              <AttributesTable
                attributes={sp.attributes}
                actions={{ onRemove: () => {}, onMask: () => {} }}
                onAddAttribute={openAdd ? () => openAdd(sp.name ? `Span: ${sp.name}` : `Span ${idx + 1}`, { kind: "span", indexPath: scopeIndex != null ? [scopeIndex, idx] : [idx] }) : undefined}
              />
              {renderSpanEvents(sp as unknown as { events?: Array<{ attributes?: AttributeKV[] }> })}
              {renderSpanLinks(sp as unknown as { links?: Array<{ attributes?: AttributeKV[] }> })}
            </Collapsible>
          </section>
        ))}
      </section>
    </Collapsible>
  );
}

function renderSpanEvents(sp: { events?: Array<{ attributes?: AttributeKV[] }> }) {
  const events = asArray<{ attributes?: AttributeKV[] }>(sp.events);
  const withAttrs = events.filter((e) => Array.isArray(e.attributes) && e.attributes.length > 0);
  if (withAttrs.length === 0) return null;
  return (
    <Collapsible title="Spans.events" defaultOpen={false}>
      <section className="space-y-3">
        {withAttrs.map((e, i) => (
          <AttributesTable key={`event-${i}`} title={`Event ${i + 1}`} attributes={e.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} />
        ))}
      </section>
    </Collapsible>
  );
}

function renderSpanLinks(sp: { links?: Array<{ attributes?: AttributeKV[] }> }) {
  const links = asArray<{ attributes?: AttributeKV[] }>(sp.links);
  const withAttrs = links.filter((l) => Array.isArray(l.attributes) && l.attributes.length > 0);
  if (withAttrs.length === 0) return null;
  return (
    <Collapsible title="Spans.links" defaultOpen={false}>
      <section className="space-y-3">
        {withAttrs.map((l, i) => (
          <AttributesTable key={`link-${i}`} title={`Link ${i + 1}`} attributes={l.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} />
            ))}
          </section>
    </Collapsible>
  );
}

function renderLogs(doc: LogsDocView, opts: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void; openAdd: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void }) {
  const rls = asArray<ResourceLogsView>(doc.resourceLogs);
  if (rls.length === 0) return <p className="text-sm text-muted-foreground">No log content.</p>;

  const sections: ReactNode[] = [];
  // Resource (only if attributes exist)
  const first = rls[0];
  const resourceAttrs = (first as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes;
  if (Array.isArray(resourceAttrs) && resourceAttrs.length > 0) {
    sections.push(
      <section id="loc-resource" key="loc-resource">
        <Collapsible key="resource" title="Resource">
          <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
        </Collapsible>
      </section>
    );
  }

  // View switcher (grouped vs flat)
  sections.push(
    <section key="logs-view" className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View:</span>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "grouped" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("grouped")}>Grouped</button>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "flat" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("flat")}>Flat</button>
    </section>
  );

  const scopeLogsAll = rls.flatMap((rl) => asArray<ScopeLogsView>(rl.scopeLogs));

  if (opts.logsView === "grouped") {
    // Group by scope, show scope header (name@version) and records under it; attributes shown if present
    sections.push(
      <section key="grouped" id="loc-scopes" className="space-y-3">
        {scopeLogsAll.map((sl, i) => {
          const sc = (sl as unknown as { scope?: { name?: string; version?: string; attributes?: AttributeKV[] } }).scope;
          const label = [sc?.name, sc?.version].filter(Boolean).join(" @ ") || `Scope ${i + 1}`;
          const records = asArray<LogRecordView>(sl.logRecords);
          const recordsWithAttrs = records.filter((lr) => Array.isArray(lr.attributes) && lr.attributes.length > 0);
          if (!sc?.attributes?.length && recordsWithAttrs.length === 0) return null;
          return (
            <section id={`loc-log-scope-${i + 1}`} key={`loc-log-scope-${i + 1}`}>
              <Collapsible key={`scope-block-${i}`} title={`Scope: ${label}`} defaultOpen>
                {Array.isArray(sc?.attributes) && sc.attributes.length > 0 && (
                  <AttributesTable title="Attributes" attributes={sc.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope: ${label}`, { kind: "scope", indexPath: [i] })} />
                )}
                {recordsWithAttrs.length > 0 && (
                  <section>
                    <Collapsible title="Log records" defaultOpen>
                      <section className="space-y-3">
                        {recordsWithAttrs.map((lr, j) => (
                          <section id={`loc-record-${i}-${j}`} key={`loc-record-${i}-${j}`}>
                            <Collapsible title={lr.severityText ?? `Record ${j + 1}`} subtitle={lr.timeUnixNano}>
                              <AttributesTable attributes={lr.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Record ${j + 1}`, { kind: "log", indexPath: [i, j] })} />
                            </Collapsible>
                          </section>
                        ))}
                      </section>
                    </Collapsible>
                  </section>
                )}
              </Collapsible>
            </section>
          );
        })}
      </section>
    );
  } else {
    // Flat list of all records with scope label in subtitle
    const scopeRecords: Array<{ scopeName?: string; record: LogRecordView }> = [];
    for (const sl of scopeLogsAll) {
      const scopeName = (sl as unknown as { scope?: { name?: string } }).scope?.name;
      const records = asArray<LogRecordView>(sl.logRecords);
      for (const lr of records) {
        if (Array.isArray(lr.attributes) && lr.attributes.length > 0) scopeRecords.push({ scopeName, record: lr });
      }
    }
    if (scopeRecords.length > 0) {
      sections.push(
        <section id="loc-records" key="loc-records">
          <Collapsible key="records" title="Log records" defaultOpen>
            <section className="space-y-3">
              {scopeRecords.map(({ scopeName, record }, i) => (
                <section id={`loc-record-flat-${i}`} key={`loc-record-flat-${i}`}>
                  <Collapsible
                    key={`${scopeName ?? "_"}-${keyForLog(record)}`}
                    title={record.severityText ?? `Record ${i + 1}`}
                    subtitle={[scopeName, record.timeUnixNano].filter(Boolean).join(" • ") || undefined}
                  >
                    <AttributesTable attributes={record.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Record ${i + 1}`, { kind: "log", indexPath: [i] })} />
                  </Collapsible>
                </section>
              ))}
            </section>
          </Collapsible>
        </section>
      );
    }
  }

  return <section className="space-y-3">{sections}</section>;
}

// (helper removed; inline rendering used in renderLogs)

function renderMetrics(doc: MetricsDocView, opts: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void; openAdd: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void }) {
  const rms = asArray<ResourceMetricsView>(doc.resourceMetrics);
  if (rms.length === 0) return <p className="text-sm text-muted-foreground">No metric content.</p>;

  const sections: ReactNode[] = [];

  // Resource (only if attributes exist)
  const first = rms[0];
  const resourceAttrs = (first as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes;
  if (Array.isArray(resourceAttrs) && resourceAttrs.length > 0) {
    sections.push(
      <section id="loc-resource" key="loc-resource">
        <Collapsible key="resource" title="Resource">
          <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
        </Collapsible>
      </section>
    );
  }

  // View switcher (reuse grouped/flat toggle for metrics)
  sections.push(
    <section key="metrics-view" className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View:</span>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "grouped" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("grouped")}>Grouped</button>
      <button type="button" className={`text-xs rounded px-2 py-1 border ${opts.logsView === "flat" ? "bg-secondary" : ""}`} onClick={() => opts.setLogsView("flat")}>Flat</button>
    </section>
  );

  const scopeMetricsAll = rms.flatMap((rm) => asArray<ScopeMetricsView>(rm.scopeMetrics));

  if (opts.logsView === "grouped") {
    sections.push(
      <section key="loc-scopes" id="loc-scopes" className="space-y-3">
        {scopeMetricsAll.map((sm, i) => {
          const sc = (sm as unknown as { scope?: { name?: string; version?: string; attributes?: AttributeKV[] } }).scope;
          const label = [sc?.name, sc?.version].filter(Boolean).join(" @ ") || `Scope ${i + 1}`;
          const metrics = asArray<MetricView>(sm.metrics);
          const hasScopeAttrs = Array.isArray(sc?.attributes) && sc!.attributes!.length > 0;
          const hasMetrics = metrics.length > 0;
          if (!hasScopeAttrs && !hasMetrics) return null;
          return (
            <section id={`loc-metric-scope-${i + 1}`} key={`loc-metric-scope-${i + 1}`}>
              <Collapsible key={`metric-scope-${i}`} title={`Scope: ${label}`} defaultOpen>
                {hasScopeAttrs && (
                  <AttributesTable title="Attributes" attributes={sc?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope: ${label}`, { kind: "scope", indexPath: [i] })} />
                )}
                {hasMetrics && (
                  <section className="space-y-3" id={i === 0 ? "loc-datapoints" : undefined}>
                    {metrics.flatMap((m, mi) => {
                      const dps = metricDatapointsOf(m);
                      return dps.map((dp, di) => (
                        <section id={`loc-dp-${i}-${mi}-${di}`} key={`loc-dp-${i}-${mi}-${di}`}>
                          <Collapsible
                            key={`dp-${i}-${mi}-${di}`}
                            title={`Datapoint ${di + 1}`}
                            subtitle={[dp.timeUnixNano, dp.value != null ? `value: ${String(dp.value)}` : undefined].filter(Boolean).join(" • ") || undefined}
                          >
                            <AttributesTable title="Attributes" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Datapoint ${di + 1}`, { kind: "datapoint", indexPath: [i, mi, di] })} />
                          </Collapsible>
                        </section>
                      ));
                    })}
                  </section>
                )}
              </Collapsible>
            </section>
          );
        })}
      </section>
    );
  } else {
    const allMetrics: Array<{ scopeLabel?: string; metric: MetricView }> = [];
    for (const sm of scopeMetricsAll) {
      const sc = (sm as unknown as { scope?: { name?: string; version?: string } }).scope;
      const scopeLabel = [sc?.name, sc?.version].filter(Boolean).join(" @ ") || undefined;
      for (const m of asArray<MetricView>(sm.metrics)) allMetrics.push({ scopeLabel, metric: m });
    }
    if (allMetrics.length) {
      const allDps: Array<{ scopeLabel?: string; metric: MetricView; dp: DataPointView; idx: number; coord: { i: number; mi: number; di: number } }> = [];
      allMetrics.forEach(({ scopeLabel, metric }, mi) => {
        for (const dp of metricDatapointsOf(metric)) allDps.push({ scopeLabel, metric, dp, idx: allDps.length + 1, coord: { i: 0, mi, di: allDps.length } });
      });
      if (allDps.length) {
        sections.push(
          <section id="loc-datapoints" key="loc-datapoints">
            <Collapsible key="flat-dps" title="Datapoints" defaultOpen>
              <section className="space-y-3">
                {allDps.map(({ metric, scopeLabel, dp, idx }) => (
                  <section id={`loc-dp-flat-${idx}`} key={`loc-dp-flat-${idx}`}>
                    <Collapsible key={`dpflat-${idx}-${metric.name ?? "metric"}`} title={`Datapoint ${idx}`} subtitle={[scopeLabel, dp.timeUnixNano, dp.value != null ? `value: ${String(dp.value)}` : undefined].filter(Boolean).join(" • ") || undefined}>
                      <AttributesTable title="Attributes" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Datapoint ${idx}`, { kind: "datapoint", indexPath: [idx] })} />
                    </Collapsible>
                  </section>
                ))}
              </section>
            </Collapsible>
          </section>
        );
      }
    }
  }

  return <section className="space-y-3">{sections}</section>;
}

// (no standalone metric series renderer; we render datapoints directly under scopes)

// datapoint renderer inlined where used

function metricDatapointsOf(m: MetricView): DataPointView[] {
  if (m.sum?.dataPoints) return m.sum.dataPoints as DataPointView[];
  if (m.gauge?.dataPoints) return m.gauge.dataPoints as DataPointView[];
  if (m.histogram?.dataPoints) return m.histogram.dataPoints as DataPointView[];
  return [];
}

function asArray<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function keyFallback(): string { return Math.random().toString(36).slice(2); }
function keyForLog(lr: LogRecordView): string { return lr.timeUnixNano ?? (typeof lr.body === "string" ? lr.body.slice(0, 32) : undefined) ?? keyFallback(); }
// function keyForMetric(m: MetricView): string { return m.name ?? keyFallback(); }

function computeLocationTabs(parsed: unknown, signal: string, opts: { logsView: "grouped" | "flat" }): Array<{ id: string; label: string }> {
  const tabs: Array<{ id: string; label: string }> = [];
  try {
    if (!parsed) return tabs;
    if (signal === "traces") {
      const doc = parsed as TracesDocView;
      const rss = asArray<ResourceSpansView>(doc.resourceSpans);
      const rs0 = rss[0] as unknown as { resource?: { attributes?: AttributeKV[] }; scopeSpans?: ScopeSpansView[] };
      const hasResource = Array.isArray(rs0?.resource?.attributes) && (rs0.resource!.attributes!.length > 0);
      const scopeSpans = asArray<ScopeSpansView>(rs0?.scopeSpans);
      if (hasResource) tabs.push({ id: "loc-resource", label: "Resource" });
      // Per-scope entries and spans
      scopeSpans.forEach((ss, i) => {
        const scopeHasAttrs = Array.isArray(ss.scope?.attributes) && (ss.scope!.attributes!.length > 0);
        const spans = asArray<SpanView>(ss.spans);
        const scopeHasSpans = spans.length > 0;
        if (scopeHasAttrs || scopeHasSpans) tabs.push({ id: `loc-scope-${i + 1}`, label: `Scope ${i + 1}` });
        spans.forEach((sp, idx) => {
          const hasSpanAttrs = Array.isArray(sp.attributes) && (sp.attributes!.length > 0);
          if (hasSpanAttrs) tabs.push({ id: `loc-span-${String(i)}-${idx}`, label: sp.name ?? `Span ${idx + 1}` });
        });
      });
    } else if (signal === "logs") {
      const doc = parsed as LogsDocView;
      const rls = asArray<ResourceLogsView>(doc.resourceLogs);
      const rl0 = rls[0] as unknown as { resource?: { attributes?: AttributeKV[] }; scopeLogs?: ScopeLogsView[] };
      const hasResource = Array.isArray(rl0?.resource?.attributes) && (rl0.resource!.attributes!.length > 0);
      const scopeLogs = asArray<ScopeLogsView>(rl0?.scopeLogs);
      if (hasResource) tabs.push({ id: "loc-resource", label: "Resource" });
      scopeLogs.forEach((sl, i) => {
        const sc = (sl as unknown as { scope?: { attributes?: AttributeKV[] } }).scope;
        const scopeHasAttrs = Array.isArray(sc?.attributes) && (sc!.attributes!.length > 0);
        const records = asArray<LogRecordView>(sl.logRecords);
        const recsWithAttrs = records.filter((lr) => Array.isArray(lr.attributes) && lr.attributes.length > 0);
        if (scopeHasAttrs || recsWithAttrs.length > 0) tabs.push({ id: `loc-log-scope-${i + 1}`, label: `Scope ${i + 1}` });
        recsWithAttrs.forEach((lr, j) => {
          const label = lr.severityText ?? `Record ${i + 1}.${j + 1}`;
          tabs.push({ id: `loc-record-${i}-${j}`, label });
        });
      });
    } else if (signal === "metrics") {
      const doc = parsed as MetricsDocView;
      const rms = asArray<ResourceMetricsView>(doc.resourceMetrics);
      const rm0 = rms[0] as unknown as { resource?: { attributes?: AttributeKV[] }; scopeMetrics?: ScopeMetricsView[] };
      const hasResource = Array.isArray(rm0?.resource?.attributes) && (rm0.resource!.attributes!.length > 0);
      const scopeMetrics = asArray<ScopeMetricsView>(rm0?.scopeMetrics);
      if (hasResource) tabs.push({ id: "loc-resource", label: "Resource" });
      scopeMetrics.forEach((sm, i) => {
        const sc = (sm as unknown as { scope?: { attributes?: AttributeKV[] } }).scope;
        const scopeHasAttrs = Array.isArray(sc?.attributes) && (sc!.attributes!.length > 0);
        const metrics = asArray<MetricView>((sm as unknown as { metrics?: MetricView[] }).metrics);
        const hasAnyDps = metrics.some((m) => metricDatapointsOf(m).length > 0);
        if (scopeHasAttrs || hasAnyDps) tabs.push({ id: `loc-metric-scope-${i + 1}`, label: `Scope ${i + 1}` });
        metrics.forEach((m, mi) => {
          const dps = metricDatapointsOf(m);
          dps.forEach((_, di) => tabs.push({ id: `loc-dp-${i}-${mi}-${di}`, label: `Datapoint ${di + 1}` }));
        });
      });
    }
  } catch {}
  return tabs;
}


