"use client";

type Props = {
  title: string;
  subtitle?: string;
};

export default function CanvasBlock({ title, subtitle }: Props) {
  return (
    <article aria-label={title} className="rounded border px-3 py-2 bg-card text-card-foreground">
      <header className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
      </header>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </article>
  );
}


