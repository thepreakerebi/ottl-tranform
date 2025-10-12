"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
};

export default function Collapsible({ title, subtitle, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <details className="rounded-md border bg-card text-card-foreground" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer list-none">
        <header className="flex items-center justify-between gap-2 p-3">
          <section className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </section>
          <section className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" aria-label={open ? "Collapse" : "Expand"} className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}>
              <ChevronDown className="size-4" />
            </Button>
          </section>
        </header>
      </summary>
      <section className="p-3 pt-0">
        {children}
      </section>
    </details>
  );
}


