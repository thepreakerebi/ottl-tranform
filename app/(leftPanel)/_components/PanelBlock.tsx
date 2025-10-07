"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";

type Props = {
  icon: React.ReactNode;
  name: string;
  description: string;
  groupTitle?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export default function PanelBlock({ icon, name, description, groupTitle, onSelect, disabled = false }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `block-${groupTitle ?? "general"}-${name}`,
    data: { label: name, groupTitle: groupTitle ?? "General" },
    disabled,
  });

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={setNodeRef}
            {...(mounted && !disabled ? listeners : {})}
            {...(mounted && !disabled ? attributes : {})}
            type="button"
            onClick={() => {
              if (!disabled) onSelect?.();
            }}
            aria-disabled={disabled}
            className={`w-full text-left rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 ${
              disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent focus:bg-accent cursor-grab active:cursor-grabbing"
            }`}
          >
            <span aria-hidden className="inline-flex items-center justify-center rounded-sm">
              {icon}
            </span>
            <span className="text-sm">{name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
    </li>
  );
}


