import { create } from "zustand";
import type { Snapshot, DiffChange } from "../ottl/types";

interface PreviewState {
  stepIndex: number; // selected step
  snapshots: Snapshot[];
  changes: DiffChange[];
  filters: { added: boolean; removed: boolean; modified: boolean };
  setStepIndex: (i: number) => void;
  setSnapshots: (s: Snapshot[]) => void;
  setChanges: (c: DiffChange[]) => void;
  setFilters: (f: Partial<PreviewState["filters"]>) => void;
  clear: () => void;
}

export const usePreviewStore = create<PreviewState>()((set) => ({
  stepIndex: 0,
  snapshots: [],
  changes: [],
  filters: { added: true, removed: true, modified: true },
  setStepIndex: (i) => set({ stepIndex: i }),
  setSnapshots: (s) => set({ snapshots: s }),
  setChanges: (c) => set({ changes: c }),
  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),
  clear: () =>
    set({ stepIndex: 0, snapshots: [], changes: [], filters: { added: true, removed: true, modified: true } }),
}));


