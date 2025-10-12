"use client";

import { Ellipsis, Pencil, VenetianMask, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  CustomDropdownMenu,
  CustomDropdownMenuTrigger,
  CustomDropdownMenuContent,
  CustomDropdownMenuItem,
  CustomDropdownMenuSeparator,
} from "../../../components/ui/custom-dropdown-menu";

type Props = {
  onEdit?: () => void;
  onMask?: () => void;
  onRemove?: () => void;
  ariaLabel?: string;
};

export default function ActionMenu({ onEdit, onMask, onRemove, ariaLabel = "Row actions" }: Props) {
  return (
    <CustomDropdownMenu>
      <CustomDropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={ariaLabel}>
          <Ellipsis className="size-4" />
        </Button>
      </CustomDropdownMenuTrigger>
      <CustomDropdownMenuContent className="min-w-[10rem] p-1">
        <CustomDropdownMenuItem onSelect={onEdit} role="menuitem">
          <Pencil className="size-4" />
          <span className="text-sm">Edit</span>
        </CustomDropdownMenuItem>
        <CustomDropdownMenuItem onSelect={onMask} role="menuitem">
          <VenetianMask className="size-4" />
          <span className="text-sm">Mask</span>
        </CustomDropdownMenuItem>
        <CustomDropdownMenuSeparator />
        <CustomDropdownMenuItem onSelect={onRemove} role="menuitem" data-variant="destructive">
          <Trash2 className="size-4" />
          <span className="text-sm">Remove</span>
        </CustomDropdownMenuItem>
      </CustomDropdownMenuContent>
    </CustomDropdownMenu>
  );
}


