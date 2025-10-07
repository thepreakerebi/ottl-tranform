"use client";

import { createContext, useContext, useMemo } from "react";

type WorkersContextValue = {
  // placeholders for future worker proxies
  transformWorker?: Worker;
  diffWorker?: Worker;
};

const WorkersContext = createContext<WorkersContextValue | undefined>(undefined);

type Props = { children: React.ReactNode };

export default function WorkersProvider({ children }: Props) {
  const value = useMemo<WorkersContextValue>(() => ({
    transformWorker: undefined,
    diffWorker: undefined,
  }), []);

  return (
    <WorkersContext.Provider value={value}>{children}</WorkersContext.Provider>
  );
}

export function useWorkers() {
  const ctx = useContext(WorkersContext);
  if (!ctx) throw new Error("useWorkers must be used within WorkersProvider");
  return ctx;
}


