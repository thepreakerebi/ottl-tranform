"use client";

import CanvasView from "./CanvasView";
import RawOTTLView from "./RawOTTLView";
import BottomBar from "./BottomBar";
import { useUIStore } from "../../lib/stores/uiStore";

export default function MiddleView() {
  const active = useUIStore((s) => s.activeMiddleTab);
  return (
    <main aria-label="Pipeline canvas and OTTL" className="relative h-full overflow-hidden">
      <div className="h-full pb-24">
        <div className="h-full overflow-hidden">
          {active === "canvas" ? <CanvasView /> : <RawOTTLView />}
        </div>
      </div>
      <BottomBar />
    </main>
  );
}


