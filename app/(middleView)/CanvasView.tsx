"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";
import AttributesTable from "./_components/AttributesTable";
import Collapsible from "./_components/Collapsible";
import AddAttributeDialog from "./_components/AddAttributeDialog";

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

  return (
    <section aria-label="Canvas" className="h-full overflow-y-auto overflow-x-hidden p-4">
      {content}
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
              const currentTarget = addTarget!;
              const kind = currentTarget.path.kind;
              const idx = currentTarget.path.indexPath ?? [];
              let source = "";
              if (signal === "traces") {
                const rss = asArray<ResourceSpansView>((parsed as unknown as TracesDocView)?.resourceSpans);
                const rs0 = rss[0];
                if (kind === "resource") source = readAttr((rs0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                else if (kind === "scope") source = readAttr((rs0 as unknown as { scopeSpans?: Array<{ scope?: { attributes?: AttributeKV[] } }> }).scopeSpans?.[idx[0] ?? 0]?.scope?.attributes as unknown[] | undefined);
                else if (kind === "span") source = readAttr((rs0 as unknown as { scopeSpans?: Array<{ spans?: Array<{ attributes?: AttributeKV[] }> }> }).scopeSpans?.[(idx.length===2?idx[0]:0)]?.spans?.[(idx.length===2?idx[1]:idx[0]??0)]?.attributes as unknown[] | undefined);
              } else if (signal === "logs") {
                const rls = asArray<ResourceLogsView>((parsed as unknown as LogsDocView)?.resourceLogs);
                const rl0 = rls[0];
                if (kind === "resource") source = readAttr((rl0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                else if (kind === "scope") source = readAttr((rl0 as unknown as { scopeLogs?: Array<{ scope?: { attributes?: AttributeKV[] } }> }).scopeLogs?.[idx[0] ?? 0]?.scope?.attributes as unknown[] | undefined);
                else if (kind === "log") source = readAttr((rl0 as unknown as { scopeLogs?: Array<{ logRecords?: Array<{ attributes?: AttributeKV[] }> }> }).scopeLogs?.[idx[0] ?? 0]?.logRecords?.[idx[1] ?? 0]?.attributes as unknown[] | undefined);
              } else if (signal === "metrics") {
                const rms = asArray<ResourceMetricsView>((parsed as unknown as MetricsDocView)?.resourceMetrics);
                const rm0 = rms[0];
                if (kind === "resource") source = readAttr((rm0 as unknown as { resource?: { attributes?: AttributeKV[] } }).resource?.attributes as unknown[] | undefined);
                else if (kind === "scope") source = readAttr((rm0 as unknown as { scopeMetrics?: Array<{ scope?: { attributes?: AttributeKV[] } }> }).scopeMetrics?.[idx[0] ?? 0]?.scope?.attributes as unknown[] | undefined);
                else if (kind === "datapoint") {
                  const sm = (rm0 as unknown as { scopeMetrics?: Array<{ metrics?: MetricView[] }> }).scopeMetrics?.[idx[0] ?? 0];
                  const metric = (sm as unknown as { metrics?: MetricView[] })?.metrics?.[idx[1] ?? 0];
                  const dpsArr = metricDatapointsOf(metric as MetricView);
                  source = readAttr(Array.isArray(dpsArr) ? (dpsArr[idx[2] ?? 0]?.attributes as unknown[] | undefined) : undefined);
                }
              }
              const slice = end == null ? source.slice(start) : source.slice(start, end);
              return slice;
            }

            const finalString = computeValueFromContext();
            const vobj = { stringValue: finalString } as Record<string, unknown>;
            const kv = { key: payload.key, value: vobj } as { key: string; value: Record<string, unknown> };
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
                const resObj = res as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = resObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                resObj.attributes = arr;
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeSpans = asArr(rs0?.["scopeSpans"]);
                const ss = asRec(scopeSpans[i]);
                const scope = asRec(ss?.["scope"]);
                const scObj = scope as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = scObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                scObj.attributes = arr;
              } else if (kind === "span") {
                // indexPath: [scopeIndex?, spanIndex]
                const scopeIndex = idx.length === 2 ? idx[0] : 0;
                const spanIndex = idx.length === 2 ? idx[1] : idx[0] ?? 0;
                const scopeSpans = asArr(rs0?.["scopeSpans"]);
                const ss = asRec(scopeSpans[scopeIndex]);
                const spans = asArr(ss?.["spans"]);
                const sp = asRec(spans[spanIndex]);
                const spObj = sp as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = spObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                spObj.attributes = arr;
              }
            } else if (signal === "logs") {
              const rls = asArr(cloned["resourceLogs"]);
              const rl0 = asRec(rls[0]);
              if (kind === "resource") {
                const res = asRec(rl0?.["resource"]);
                const resObj = res as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = resObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                resObj.attributes = arr;
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeLogs = asArr(rl0?.["scopeLogs"]);
                const sl = asRec(scopeLogs[i]);
                const scope = asRec(sl?.["scope"]);
                const scObj = scope as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = scObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                scObj.attributes = arr;
              } else if (kind === "log") {
                const i = idx[0] ?? 0; const j = idx[1] ?? 0;
                const scopeLogs = asArr(rl0?.["scopeLogs"]);
                const sl = asRec(scopeLogs[i]);
                const logRecords = asArr(sl?.["logRecords"]);
                const lr = asRec(logRecords[j]);
                const lrObj = lr as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = lrObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                lrObj.attributes = arr;
              }
            } else if (signal === "metrics") {
              const rms = asArr(cloned["resourceMetrics"]);
              const rm0 = asRec(rms[0]);
              if (kind === "resource") {
                const res = asRec(rm0?.["resource"]);
                const resObj = res as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = resObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                resObj.attributes = arr;
              } else if (kind === "scope") {
                const i = idx[0] ?? 0;
                const scopeMetrics = asArr(rm0?.["scopeMetrics"]);
                const sm = asRec(scopeMetrics[i]);
                const scope = asRec(sm?.["scope"]);
                const scObj = scope as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = scObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                scObj.attributes = arr;
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
                const dpObj = dp as unknown as { attributes?: Array<{ key: string; value: Record<string, unknown> }> };
                const arr = dpObj.attributes ?? [];
                if (!arr.some((a) => a.key === kv.key && JSON.stringify(a.value) === JSON.stringify(kv.value))) arr.push(kv);
                dpObj.attributes = arr;
              }
            }
            setParsed(cloned as unknown as import("../../lib/ottl/types").JSONValue);
            // Push a lightweight snapshot so RightPanel shows an After diff
            import("../../lib/stores/previewStore").then((mod) => {
              const previews = mod.usePreviewStore.getState();
              const nextStep = previews.snapshots.length;
              const beforeVal = parsed as unknown as import("../../lib/ottl/types").JSONValue;
              const afterVal = cloned as unknown as import("../../lib/ottl/types").JSONValue;
              previews.setSnapshots([...previews.snapshots, { stepIndex: nextStep, before: beforeVal, after: afterVal }]);
              previews.setStepIndex(nextStep);
              previews.setAutoJump(true);
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
      <Collapsible key="resource" title="Resource">
        <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
      </Collapsible>
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
        <Collapsible key="scopes" title="Scopes" defaultOpen>
          <section className="space-y-3">
            {scopesWithAttrsOrSpans.map((ss, i) => (
              <Collapsible key={`scope-${i}`} title={`Scope ${i + 1}`} defaultOpen>
                {Array.isArray(ss.scope?.attributes) && ss.scope!.attributes!.length > 0 && (
                  <AttributesTable attributes={ss.scope?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope ${i + 1}`, { kind: "scope", indexPath: [i] })} />
                )}
                {Array.isArray(ss.spans) && ss.spans.length > 0 && renderSpans(ss.spans, opts.openAdd, i)}
              </Collapsible>
            ))}
          </section>
        </Collapsible>
      );
    }
  } else {
    // Flat list of spans across scopes
    const spansAll = scopeSpansAll.flatMap((ss) => asArray<SpanView>(ss.spans));
    const spansElement = renderSpans(spansAll, opts.openAdd);
    if (spansElement) sections.push(<section key="spans">{spansElement}</section>);
  }

  return <section className="space-y-3">{sections}</section>;
}

function renderSpans(spans: SpanView[], openAdd?: (title: string, path: { kind: "resource" | "scope" | "span" | "log" | "datapoint"; indexPath?: number[] }) => void, scopeIndex?: number) {
  if (!spans.length) return null;
  return (
    <Collapsible title="Spans" defaultOpen>
      <section className="space-y-3">
        {spans.map((sp, idx) => (
          <Collapsible key={sp.spanId ?? `${sp.name ?? "span"}-${idx}`} title={sp.name ?? `Span ${idx + 1}`} subtitle={sp.spanId ? `spanId: ${sp.spanId}` : undefined}>
            <AttributesTable
              attributes={sp.attributes}
              actions={{ onRemove: () => {}, onMask: () => {} }}
              onAddAttribute={openAdd ? () => openAdd(sp.name ? `Span: ${sp.name}` : `Span ${idx + 1}`, { kind: "span", indexPath: scopeIndex != null ? [scopeIndex, idx] : [idx] }) : undefined}
            />
            {renderSpanEvents(sp as unknown as { events?: Array<{ attributes?: AttributeKV[] }> })}
            {renderSpanLinks(sp as unknown as { links?: Array<{ attributes?: AttributeKV[] }> })}
          </Collapsible>
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
      <Collapsible key="resource" title="Resource">
        <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
      </Collapsible>
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
      <section key="grouped" className="space-y-3">
        {scopeLogsAll.map((sl, i) => {
          const sc = (sl as unknown as { scope?: { name?: string; version?: string; attributes?: AttributeKV[] } }).scope;
          const label = [sc?.name, sc?.version].filter(Boolean).join(" @ ") || `Scope ${i + 1}`;
          const records = asArray<LogRecordView>(sl.logRecords);
          const recordsWithAttrs = records.filter((lr) => Array.isArray(lr.attributes) && lr.attributes.length > 0);
          if (!sc?.attributes?.length && recordsWithAttrs.length === 0) return null;
          return (
            <Collapsible key={`scope-block-${i}`} title={`Scope: ${label}`} defaultOpen>
              {Array.isArray(sc?.attributes) && sc.attributes.length > 0 && (
                <AttributesTable title="Attributes" attributes={sc.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope: ${label}`, { kind: "scope", indexPath: [i] })} />
              )}
              {recordsWithAttrs.length > 0 && (
                <Collapsible title="Log records" defaultOpen>
                  <section className="space-y-3">
                    {recordsWithAttrs.map((lr, j) => (
                      <Collapsible key={`rec-${i}-${j}-${keyForLog(lr)}`} title={lr.severityText ?? `Record ${j + 1}`} subtitle={lr.timeUnixNano}>
                        <AttributesTable attributes={lr.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Record ${j + 1}`, { kind: "log", indexPath: [i, j] })} />
                      </Collapsible>
                    ))}
                  </section>
                </Collapsible>
              )}
            </Collapsible>
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
        <Collapsible key="records" title="Log records" defaultOpen>
          <section className="space-y-3">
            {scopeRecords.map(({ scopeName, record }, i) => (
              <Collapsible
                key={`${scopeName ?? "_"}-${keyForLog(record)}`}
                title={record.severityText ?? `Record ${i + 1}`}
                subtitle={[scopeName, record.timeUnixNano].filter(Boolean).join(" • ") || undefined}
              >
                <AttributesTable attributes={record.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Record ${i + 1}`, { kind: "log", indexPath: [i] })} />
              </Collapsible>
            ))}
          </section>
        </Collapsible>
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
      <Collapsible key="resource" title="Resource">
        <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd("Resource", { kind: "resource" })} />
      </Collapsible>
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
      <section key="grouped-metrics" className="space-y-3">
        {scopeMetricsAll.map((sm, i) => {
          const sc = (sm as unknown as { scope?: { name?: string; version?: string; attributes?: AttributeKV[] } }).scope;
          const label = [sc?.name, sc?.version].filter(Boolean).join(" @ ") || `Scope ${i + 1}`;
          const metrics = asArray<MetricView>(sm.metrics);
          const hasScopeAttrs = Array.isArray(sc?.attributes) && sc!.attributes!.length > 0;
          const hasMetrics = metrics.length > 0;
          if (!hasScopeAttrs && !hasMetrics) return null;
          return (
            <Collapsible key={`metric-scope-${i}`} title={`Scope: ${label}`} defaultOpen>
              {hasScopeAttrs && (
                <AttributesTable title="Attributes" attributes={sc?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Scope: ${label}`, { kind: "scope", indexPath: [i] })} />
              )}
              {hasMetrics && (
                <section className="space-y-3">
                  {metrics.flatMap((m, mi) => {
                    const dps = metricDatapointsOf(m);
                    return dps.map((dp, di) => (
                      <Collapsible
                        key={`dp-${i}-${mi}-${di}`}
                        title={`Datapoint ${di + 1}`}
                        subtitle={[dp.timeUnixNano, dp.value != null ? `value: ${String(dp.value)}` : undefined].filter(Boolean).join(" • ") || undefined}
                      >
                        <AttributesTable title="Attributes" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Datapoint ${di + 1}`, { kind: "datapoint", indexPath: [i, mi, di] })} />
                      </Collapsible>
                    ));
                  })}
                </section>
              )}
            </Collapsible>
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
      const allDps: Array<{ scopeLabel?: string; metric: MetricView; dp: DataPointView; idx: number }> = [];
      allMetrics.forEach(({ scopeLabel, metric }) => {
        for (const dp of metricDatapointsOf(metric)) allDps.push({ scopeLabel, metric, dp, idx: allDps.length + 1 });
      });
      if (allDps.length) {
        sections.push(
          <Collapsible key="flat-dps" title="Datapoints" defaultOpen>
            <section className="space-y-3">
              {allDps.map(({ metric, scopeLabel, dp, idx }) => (
                <Collapsible key={`dp-${idx}-${metric.name ?? "metric"}`} title={`Datapoint ${idx}`} subtitle={[scopeLabel, dp.timeUnixNano, dp.value != null ? `value: ${String(dp.value)}` : undefined].filter(Boolean).join(" • ") || undefined}>
                  <AttributesTable title="Attributes" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => opts.openAdd(`Datapoint ${idx}`, { kind: "datapoint", indexPath: [idx] })} />
                </Collapsible>
              ))}
            </section>
          </Collapsible>
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


