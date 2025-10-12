"use client";

import Image from "next/image";
import TelemetryEditor from "./TelemetryEditor";

export default function LeftPanel() {
  return (
    <aside aria-label="Configuration panel" className="h-full min-h-0 flex flex-col border-r">
      <header className="p-4 flex flex-col gap-2 border-b">
        <figure className="flex items-center gap-2">
          <Image src="/Logo.svg" alt="OTTL Transformer logo" width={50} height={20} />
          <figcaption className="text-sm font-medium">Transform telemetry data visually</figcaption>
        </figure>
        <p className="text-sm text-muted-foreground">Paste telemetry data below</p>
      </header>
      <TelemetryEditor />
    </aside>
  );
}


