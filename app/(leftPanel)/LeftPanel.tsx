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
      <section aria-label="Transformation blocks" className="border-t overflow-auto p-4 max-h-[50%]">
        <h2 className="text-sm font-semibold mb-2">Blocks</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Add Attribute</li>
          <li>Remove Attribute</li>
          <li>Rename Attribute</li>
          <li>Mask Attribute</li>
        </ul>
      </section>
    </aside>
  );
}


