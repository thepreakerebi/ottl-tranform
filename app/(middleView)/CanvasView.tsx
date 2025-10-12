"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTelemetryStore } from "../../lib/stores/telemetryStore";
import AttributesTable from "./_components/AttributesTable";
import Collapsible from "./_components/Collapsible";

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
  const signal = useTelemetryStore((s) => s.signal);

  // Logs view mode: grouped by scope (default) or flat list
  const [logsView, setLogsView] = useState<"grouped" | "flat">("grouped");

  const content = useMemo(() => renderBySignal(parsed, signal, { logsView, setLogsView }), [parsed, signal, logsView]);

  return (
    <section aria-label="Canvas" className="h-full overflow-y-auto overflow-x-hidden p-4">
      {content}
    </section>
  );
}

function renderBySignal(
  parsed: unknown,
  signal: string,
  opts?: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void }
) {
  if (!parsed) {
    return <p className="text-sm text-muted-foreground">Paste telemetry data to begin.</p>;
  }
  if (signal === "traces") return renderTraces(parsed as TracesDocView);
  if (signal === "logs") return renderLogs(parsed as LogsDocView, opts!);
  if (signal === "metrics") return renderMetrics(parsed as MetricsDocView);
  return <p className="text-sm text-muted-foreground">Unsupported telemetry format.</p>;
}

function renderTraces(doc: TracesDocView) {
  const rss = asArray<ResourceSpansView>(doc.resourceSpans);
  if (rss.length === 0) return <p className="text-sm text-muted-foreground">No trace content.</p>;

  const sections: ReactNode[] = [];
  // Resource (only if attributes exist)
  const resourceAttrs = (rss[0] as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes;
  if (Array.isArray(resourceAttrs) && resourceAttrs.length > 0) {
    sections.push(
      <Collapsible key="resource" title="Resource">
        <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
      </Collapsible>
    );
  }

  // Scopes (only show scopes that actually have attributes)
  const scopeSpansAll = rss.flatMap((rs) => asArray<ScopeSpansView>(rs.scopeSpans));
  const scopesWithAttrs = scopeSpansAll.filter((ss) => Array.isArray(ss.scope?.attributes) && (ss.scope?.attributes?.length ?? 0) > 0);
  if (scopesWithAttrs.length > 0) {
    sections.push(
      <Collapsible key="scopes" title="Scopes" defaultOpen>
        <section className="space-y-3">
          {scopesWithAttrs.map((ss, i) => (
            <Collapsible key={`scope-${i}`} title={`Scope ${i + 1}`}>
              <AttributesTable attributes={ss.scope?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
            </Collapsible>
          ))}
        </section>
      </Collapsible>
    );
  }

  // Spans (top-level, not nested inside scopes)
  const spansAll = scopeSpansAll.flatMap((ss) => asArray<SpanView>(ss.spans));
  const spansElement = renderSpans(spansAll);
  if (spansElement) sections.push(<section key="spans">{spansElement}</section>);

  return <section className="space-y-3">{sections}</section>;
}

function renderSpans(spans: SpanView[]) {
  if (!spans.length) return null;
  return (
    <Collapsible title="Spans" defaultOpen>
      <section className="space-y-3">
        {spans.map((sp, idx) => (
          <Collapsible key={sp.spanId ?? `${sp.name ?? "span"}-${idx}`} title={sp.name ?? `Span ${idx + 1}`} subtitle={sp.spanId ? `spanId: ${sp.spanId}` : undefined}>
            <AttributesTable attributes={sp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
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

function renderLogs(doc: LogsDocView, opts: { logsView: "grouped" | "flat"; setLogsView: (v: "grouped" | "flat") => void }) {
  const rls = asArray<ResourceLogsView>(doc.resourceLogs);
  if (rls.length === 0) return <p className="text-sm text-muted-foreground">No log content.</p>;

  const sections: ReactNode[] = [];
  // Resource (only if attributes exist)
  const first = rls[0];
  const resourceAttrs = (first as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes;
  if (Array.isArray(resourceAttrs) && resourceAttrs.length > 0) {
    sections.push(
      <Collapsible key="resource" title="Resource">
        <AttributesTable attributes={resourceAttrs} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
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
                <AttributesTable title="Attributes" attributes={sc.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
              )}
              {recordsWithAttrs.length > 0 && (
                <Collapsible title="Log records" defaultOpen>
                  <section className="space-y-3">
                    {recordsWithAttrs.map((lr, j) => (
                      <Collapsible key={`rec-${i}-${j}-${keyForLog(lr)}`} title={lr.severityText ?? `Record ${j + 1}`} subtitle={lr.timeUnixNano}>
                        <AttributesTable attributes={lr.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
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
                <AttributesTable attributes={record.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
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

function renderMetrics(doc: MetricsDocView) {
  const rms = asArray<ResourceMetricsView>(doc.resourceMetrics);
  if (rms.length === 0) return <p className="text-sm text-muted-foreground">No metric content.</p>;

  const first = rms[0];
  const sections: ReactNode[] = [];
  sections.push(
    <Collapsible key="resource" title="Resource">
      <AttributesTable attributes={(first as unknown as { resource?: { attributes?: AttributeKV[] } })?.resource?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
    </Collapsible>
  );

  const scopeMetrics = rms.flatMap((rm) => asArray<ScopeMetricsView>(rm.scopeMetrics));
  sections.push(
    <Collapsible key="scopes" title="Scopes" defaultOpen>
      <section className="space-y-3">
        {scopeMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scopes.</p>
        ) : (
          scopeMetrics.map((sm, i) => (
            <Collapsible key={`scope-${i}`} title={`Scope ${i + 1}`}>
              <AttributesTable attributes={(sm as unknown as { scope?: { attributes?: AttributeKV[] } })?.scope?.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
              {renderMetricSeries(asArray<MetricView>(sm.metrics))}
            </Collapsible>
          ))
      )}
    </section>
    </Collapsible>
  );

  return <section className="space-y-3">{sections}</section>;
}

function renderMetricSeries(metrics: MetricView[]) {
  if (!metrics.length) return <p className="text-sm text-muted-foreground">No metrics.</p>;
  return (
    <Collapsible title="Metrics" defaultOpen>
      <section className="space-y-3">
        {metrics.map((m, i) => (
          <Collapsible key={keyForMetric(m)} title={m.name ?? `Metric ${i + 1}`} subtitle={[m.unit, m.description].filter(Boolean).join(" • ") || undefined}>
            {renderDatapoints(m)}
          </Collapsible>
        ))}
      </section>
    </Collapsible>
  );
}

function renderDatapoints(m: MetricView) {
  const dps = metricDatapointsOf(m);
  if (!dps.length) return <p className="text-sm text-muted-foreground">No datapoints.</p>;
  return (
    <Collapsible title="Datapoints" defaultOpen>
      <section className="space-y-3">
        {dps.map((dp: DataPointView, i: number) => (
          <Collapsible key={`${m.name ?? "metric"}-dp-${i}`} title={`Datapoint ${i + 1}`} subtitle={[dp.timeUnixNano, dp.value != null ? `value: ${String(dp.value)}` : undefined].filter(Boolean).join(" • ") || undefined}>
            <AttributesTable title="Labels" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} onAddAttribute={() => {}} />
          </Collapsible>
        ))}
      </section>
    </Collapsible>
  );
}

function metricDatapointsOf(m: MetricView): DataPointView[] {
  if (m.sum?.dataPoints) return m.sum.dataPoints as DataPointView[];
  if (m.gauge?.dataPoints) return m.gauge.dataPoints as DataPointView[];
  if (m.histogram?.dataPoints) return m.histogram.dataPoints as DataPointView[];
  return [];
}

function asArray<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function keyFallback(): string { return Math.random().toString(36).slice(2); }
function keyForLog(lr: LogRecordView): string { return lr.timeUnixNano ?? (typeof lr.body === "string" ? lr.body.slice(0, 32) : undefined) ?? keyFallback(); }
function keyForMetric(m: MetricView): string { return m.name ?? keyFallback(); }


