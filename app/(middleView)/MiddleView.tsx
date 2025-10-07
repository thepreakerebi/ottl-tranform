"use client";

import CanvasView from "./CanvasView";
import RawOTTLView from "./RawOTTLView";
import BottomBar from "./BottomBar";
import { useUIStore } from "../../lib/stores/uiStore";

export default function MiddleView() {
  const active = useUIStore((s) => s.activeMiddleTab);
  return (
    <main aria-label="Pipeline canvas and OTTL" className="relative h-full">
      {active === "canvas" ? <CanvasView /> : <RawOTTLView />}
      <BottomBar />
    </main>
  );
}


