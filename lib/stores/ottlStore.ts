import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OttlState {
  text: string;
  parseError?: string;
  setText: (text: string) => void;
  setParseError: (msg?: string) => void;
  clear: () => void;
}

export const useOttlStore = create<OttlState>()(
  persist(
    (set) => ({
      text: "",
      parseError: undefined,
      setText: (text) => set({ text }),
      setParseError: (msg) => set({ parseError: msg }),
      clear: () => set({ text: "", parseError: undefined }),
    }),
    { name: "ottl.session.ottl" }
  )
);


