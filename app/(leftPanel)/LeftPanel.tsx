"use client";

import Image from "next/image";

export default function LeftPanel() {
  return (
    <aside aria-label="Configuration panel" className="h-full grid grid-rows-[auto_minmax(0,1fr)_auto] border-r">
      <header className="p-4 flex flex-col gap-2">
        <figure className="flex items-center gap-2">
          <Image src="/Logo.svg" alt="OTTL Transformer logo" width={50} height={20} />
          <figcaption className="text-sm font-medium">Transform telemetry data visually</figcaption>
        </figure>
      </header>
      <section aria-label="Telemetry input and editor" className="overflow-auto p-4">
        <article aria-label="Telemetry editor placeholder" className="prose-sm text-muted-foreground">
          <p>Paste or upload telemetry to begin. Editor coming next.</p>
        </article>
      </section>
      <nav aria-label="Transformation blocks" className="border-t overflow-auto p-4">
        <h2 className="text-sm font-semibold mb-2">Blocks</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Add Attribute</li>
          <li>Remove Attribute</li>
          <li>Rename Attribute</li>
          <li>Mask Attribute</li>
        </ul>
      </nav>
    </aside>
  );
}


