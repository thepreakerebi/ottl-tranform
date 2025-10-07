"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { useDraggable } from "@dnd-kit/core";

type Props = {
  icon: React.ReactNode;
  name: string;
  description: string;
  groupTitle?: string;
  onSelect?: () => void;
};

export default function PanelBlock({ icon, name, description, groupTitle, onSelect }: Props) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `block-${groupTitle ?? "general"}-${name}`,
    data: { label: name, groupTitle: groupTitle ?? "General" },
  });

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            type="button"
            onClick={onSelect}
            className="w-full text-left rounded px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 cursor-grab active:cursor-grabbing"
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


