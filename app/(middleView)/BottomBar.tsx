"use client";

import { useUIStore } from "../../lib/stores/uiStore";

export default function BottomBar() {
  const active = useUIStore((s) => s.activeMiddleTab);
  const setActive = useUIStore((s) => s.setActiveMiddleTab);

  return (
    <footer aria-label="View switcher and run" className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
      <section className="pointer-events-auto border rounded bg-card text-card-foreground shadow-sm px-3 py-1.5 flex items-center gap-4">
        <nav aria-label="Views">
          <ul className="flex items-center gap-2">
            <li>
              <button type="button" onClick={() => setActive("canvas")} className={`text-sm ${active === "canvas" ? "font-semibold" : ""}`}>Canvas</button>
            </li>
            <li>
              <button type="button" onClick={() => setActive("raw-ottl")} className={`text-sm ${active === "raw-ottl" ? "font-semibold" : ""}`}>Raw OTTL</button>
            </li>
          </ul>
        </nav>
        <button type="button" className="text-sm rounded bg-primary text-primary-foreground px-3 py-1">Run Transformation</button>
      </section>
    </footer>
  );
}


