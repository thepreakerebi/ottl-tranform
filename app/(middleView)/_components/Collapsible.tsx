"use client";

import { Button } from "../../../components/ui/button";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  onAddAttribute?: () => void;
  children?: React.ReactNode;
};

export default function Collapsible({ title, subtitle, defaultOpen = true, onAddAttribute, children }: Props) {
  return (
    <details className="rounded-md border bg-card text-card-foreground" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <header className="flex items-center justify-between gap-2 p-3">
          <section className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </section>
          <section className="flex items-center gap-2">
            {onAddAttribute && (
              <Button type="button" variant="outline" size="sm" className="rounded-[6px]" onClick={(e) => {
                e.preventDefault();
                onAddAttribute?.();
              }}>Add attribute</Button>
            )}
          </section>
        </header>
      </summary>
      <section className="p-3 pt-0">
        {children}
      </section>
    </details>
  );
}


