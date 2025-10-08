"use client";

import { useUIStore } from "../../lib/stores/uiStore";
import { Play, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";

export default function BottomBar() {
  const active = useUIStore((s) => s.activeMiddleTab);
  const setActive = useUIStore((s) => s.setActiveMiddleTab);
  const [isRunning, setIsRunning] = useState(false);

  function handleRun() {
    if (isRunning) return;
    setIsRunning(true);
    // Placeholder async work; replace with real run callback
    setTimeout(() => setIsRunning(false), 1200);
  }

  return (
    <footer aria-label="View switcher and run" className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
      <section className="pointer-events-auto border rounded-[22px] bg-card text-card-foreground shadow-sm px-4 py-4 flex items-center gap-4">
        <nav aria-label="Views">
          <ul className="flex items-center gap-2">
            <li>
              <Button
                type="button"
                variant={active === "canvas" ? "secondary" : "ghost"}
                className="rounded-[6px] px-2 py-1"
                onClick={() => setActive("canvas")}
              >
                Canvas
              </Button>
            </li>
            <li>
              <Button
                type="button"
                variant={active === "raw-ottl" ? "secondary" : "ghost"}
                className="rounded-[6px] px-2 py-1"
                onClick={() => setActive("raw-ottl")}
              >
                Raw OTTL
              </Button>
            </li>
          </ul>
        </nav>
        <Button
          type="button"
          onClick={handleRun}
          aria-busy={isRunning}
          className="rounded-[6px] px-4 py-2 inline-flex items-center gap-2"
        >
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {isRunning ? "Running…" : "Run Transformation"}
        </Button>
      </section>
    </footer>
  );
}


