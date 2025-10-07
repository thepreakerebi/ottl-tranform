"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";

type Props = {
  icon: React.ReactNode;
  name: string;
  description: string;
  onSelect?: () => void;
};

export default function PanelBlock({ icon, name, description, onSelect }: Props) {
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSelect}
            className="w-full text-left rounded px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2"
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


