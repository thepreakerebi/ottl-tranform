import { create } from "zustand";

interface OttlState {
  text: string;
  parseError?: string;
  lastCompiled: string;
  setText: (text: string) => void;
  setParseError: (msg?: string) => void;
  setLastCompiled: (text: string) => void;
  clear: () => void;
}

export const useOttlStore = create<OttlState>()((set) => ({
  text: "",
  parseError: undefined,
  lastCompiled: "",
  setText: (text) => set({ text }),
  setParseError: (msg) => set({ parseError: msg }),
  setLastCompiled: (text) => set({ lastCompiled: text }),
  clear: () => set({ text: "", parseError: undefined, lastCompiled: "" }),
}));


