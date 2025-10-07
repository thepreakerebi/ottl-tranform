import { create } from "zustand";
import { persist } from "zustand/middleware";

type MiddleTab = "canvas" | "raw-ottl";

interface UIState {
  leftBlocksHeightPx: number; // resizable blocks library height
  activeMiddleTab: MiddleTab;
  focusTarget?: string; // id or landmark label
  setLeftBlocksHeightPx: (px: number) => void;
  setActiveMiddleTab: (tab: MiddleTab) => void;
  setFocusTarget: (id?: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      leftBlocksHeightPx: 280,
      activeMiddleTab: "canvas",
      focusTarget: undefined,
      setLeftBlocksHeightPx: (px) => set({ leftBlocksHeightPx: Math.max(160, px) }),
      setActiveMiddleTab: (tab) => set({ activeMiddleTab: tab }),
      setFocusTarget: (id) => set({ focusTarget: id }),
    }),
    { name: "ottl.session.ui" }
  )
);


