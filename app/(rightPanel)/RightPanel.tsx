"use client";

export default function RightPanel() {
  return (
    <aside aria-label="Preview panel" className="h-full border-l">
      <section className="p-4 overflow-auto h-full">
        <h2 className="text-sm font-semibold mb-2">Preview</h2>
        <p className="text-muted-foreground">Side‑by‑side diff preview will appear here.</p>
      </section>
    </aside>
  );
}


