import { create } from "zustand";
import type { Snapshot, DiffChange } from "../ottl/types";

interface PreviewState {
  stepIndex: number; // selected step
  snapshots: Snapshot[];
  changes: DiffChange[];
  filters: { added: boolean; removed: boolean; modified: boolean };
  shouldAutoJump: boolean;
  setStepIndex: (i: number) => void;
  setSnapshots: (s: Snapshot[]) => void;
  setChanges: (c: DiffChange[]) => void;
  setFilters: (f: Partial<PreviewState["filters"]>) => void;
  setAutoJump: (v: boolean) => void;
  clear: () => void;
}

export const usePreviewStore = create<PreviewState>()((set) => ({
  stepIndex: 0,
  snapshots: [],
  changes: [],
  filters: { added: true, removed: true, modified: true },
  shouldAutoJump: false,
  setStepIndex: (i) => set({ stepIndex: i }),
  setSnapshots: (s) => set({ snapshots: s }),
  setChanges: (c) => set({ changes: c }),
  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),
  setAutoJump: (v) => set({ shouldAutoJump: v }),
  clear: () =>
    set({ stepIndex: 0, snapshots: [], changes: [], filters: { added: true, removed: true, modified: true }, shouldAutoJump: false }),
}));


