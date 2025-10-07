"use client";

import { useEffect } from "react";

type Props = { children: React.ReactNode };

export default function A11yProvider({ children }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Lazy-load axe only in dev to avoid bundle bloat
      (async () => {
        try {
          const [{ default: axe }, { default: React }, { default: ReactDOM }] = await Promise.all([
            import("@axe-core/react"),
            import("react"),
            import("react-dom"),
          ]);
          axe(React, ReactDOM, 1000);
        } catch {
          // ignore loading errors in dev
        }
      })().catch(() => {
        // ignore loading errors in dev
      });
    }
  }, []);

  return children;
}


