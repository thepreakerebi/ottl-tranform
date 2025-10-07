import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JSONValue, SignalType } from "../ottl/types";

interface TelemetryState {
  rawText: string;
  parsed: JSONValue | null;
  signal: SignalType;
  parseError?: string;
  setRawText: (text: string) => void;
  setParsed: (data: JSONValue | null) => void;
  setSignal: (signal: SignalType) => void;
  setParseError: (msg?: string) => void;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      rawText: "",
      parsed: null,
      signal: "unknown",
      parseError: undefined,
      setRawText: (text) => set({ rawText: text }),
      setParsed: (data) => set({ parsed: data }),
      setSignal: (signal) => set({ signal }),
      setParseError: (msg) => set({ parseError: msg }),
      clear: () => set({ rawText: "", parsed: null, signal: "unknown", parseError: undefined }),
    }),
    {
      name: "ottl.session.telemetry",
      partialize: (state) => ({ rawText: state.rawText, signal: state.signal }),
    }
  )
);


