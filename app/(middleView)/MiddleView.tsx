"use client";

export default function MiddleView() {
  return (
    <main aria-label="Pipeline canvas and OTTL" className="h-full grid grid-rows-[minmax(0,1fr)_auto]">
      <section aria-label="Canvas or Raw OTTL view" className="overflow-auto p-4" tabIndex={0}>
        <p className="text-muted-foreground">Canvas and Raw OTTL views coming next.</p>
      </section>
      <footer aria-label="View switcher and run" className="border-t p-2 flex items-center justify-between">
        <section aria-label="View tabs">
          <ul className="flex gap-4">
            <li>Canvas</li>
            <li>Raw OTTL</li>
          </ul>
        </section>
        <button type="button" className="px-3 py-1 rounded bg-primary text-primary-foreground">Run Transformation</button>
      </footer>
    </main>
  );
}


