import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Block } from "../ottl/types";

interface PipelineState {
  blocks: Block[];
  selectedId: string | null;
  addBlock: (block: Block) => void;
  updateBlock: (id: string, update: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  select: (id: string | null) => void;
  clear: () => void;
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      blocks: [],
      selectedId: null,
      addBlock: (block) => set({ blocks: [...get().blocks, block] }),
      updateBlock: (id, update) =>
        set({
          blocks: get().blocks.map((b) => (b.id === id ? { ...b, ...update } : b)),
        }),
      removeBlock: (id) => set({ blocks: get().blocks.filter((b) => b.id !== id) }),
      reorderBlocks: (fromIndex, toIndex) =>
        set(() => {
          const next = [...get().blocks];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { blocks: next };
        }),
      select: (id) => set({ selectedId: id }),
      clear: () => set({ blocks: [], selectedId: null }),
    }),
    {
      name: "ottl.session.blocks",
    }
  )
);


