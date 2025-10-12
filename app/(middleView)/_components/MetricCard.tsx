"use client";

import AttributesTable from "./AttributesTable";
import { Button } from "../../../components/ui/button";
import { Plus } from "lucide-react";

type DataPoint = { attributes?: Array<{ key: string; value: Record<string, unknown> }>; timeUnixNano?: string; value?: number | string };
type Metric = { name?: string; description?: string; unit?: string; sum?: { dataPoints?: DataPoint[] }; gauge?: { dataPoints?: DataPoint[] }; histogram?: { dataPoints?: DataPoint[] } };

type Props = { metric: Metric };

export default function MetricCard({ metric }: Props) {
  const { name, unit, description } = metric;
  const dataPoints = datapointsOf(metric).slice(0, 3); // preview a few
  return (
    <article className="rounded-md border bg-card text-card-foreground p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{String(name ?? "(metric)")}</h3>
        <section className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{unit ?? "—"}</span>
          <Button type="button" variant="outline" size="sm" className="rounded-[6px]"> <Plus className="size-4" /> Add attribute</Button>
        </section>
      </header>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {dataPoints.map((dp, i) => (
        <section key={i} className="mt-3">
          <p className="text-[11px] text-muted-foreground mb-1">Datapoint {i + 1} {dp.timeUnixNano ? `• ${dp.timeUnixNano}` : ""} {dp.value != null ? `• value: ${String(dp.value)}` : ""}</p>
          <AttributesTable title="Labels" attributes={dp.attributes} actions={{ onRemove: () => {}, onMask: () => {} }} />
        </section>
      ))}
    </article>
  );
}

function datapointsOf(m: Metric): DataPoint[] {
  if (m.sum?.dataPoints) return m.sum.dataPoints;
  if (m.gauge?.dataPoints) return m.gauge.dataPoints;
  if (m.histogram?.dataPoints) return m.histogram.dataPoints;
  return [];
}


