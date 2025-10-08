"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

interface CustomDropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

interface CustomDropdownMenuContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuRef: React.RefObject<HTMLDivElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
  triggerRect: DOMRect | null;
  updateTriggerRect: () => void;
}

const CustomDropdownMenuContext =
  React.createContext<CustomDropdownMenuContextType | null>(null);

const useCustomDropdownMenu = () => {
  const context = React.useContext(CustomDropdownMenuContext);
  if (!context) {
    throw new Error(
      "useCustomDropdownMenu must be used within a CustomDropdownMenu",
    );
  }
  return context;
};

export function CustomDropdownMenu({
  children,
  className,
}: CustomDropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close the dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    // Close on escape key
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [open]);

  // Update trigger rect when button is clicked
  const updateTriggerRect = React.useCallback(() => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  }, []);

  // Use type assertion to fix the type error
  const value: CustomDropdownMenuContextType = {
    open,
    setOpen,
    menuRef: menuRef as React.RefObject<HTMLDivElement>,
    triggerRef: triggerRef as React.RefObject<HTMLButtonElement>,
    triggerRect,
    updateTriggerRect,
  };

  return (
    <CustomDropdownMenuContext.Provider value={value}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </CustomDropdownMenuContext.Provider>
  );
}

interface CustomDropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CustomDropdownMenuTrigger({
  children,
  onClick,
  asChild,
  ...props
}: CustomDropdownMenuTriggerProps) {
  const { setOpen, open, triggerRef, updateTriggerRect } =
    useCustomDropdownMenu();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);

    // Calculate position for the dropdown
    updateTriggerRect();

    setOpen(!open);
  };

  const Comp = asChild ? Slot : "button";
  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    "data-trigger-button": "custom-dropdown",
    onClick: handleClick,
    "aria-expanded": open,
    "aria-haspopup": "menu" as const,
    ...props,
  };

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, triggerProps);
  }

  return <Comp {...triggerProps}>{children}</Comp>;
}

interface CustomDropdownMenuContentProps {
  className?: string;
  sideOffset?: number;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

export function CustomDropdownMenuContent({
  className,
  sideOffset = 4,
  align = "start",
  children,
}: CustomDropdownMenuContentProps) {
  const { open, menuRef, triggerRef } = useCustomDropdownMenu();
  const [mounted, setMounted] = React.useState(false);

  // Handle positioning
  React.useEffect(() => {
    // Only try to position after first render
    if (!open || !triggerRef.current || !menuRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    // Position horizontally based on alignment
    let left: number;
    if (align === "center") {
      left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
    } else if (align === "end") {
      left = triggerRect.right - menuRect.width;
    } else {
      left = triggerRect.left;
    }

    // Ensure we're not going off-screen
    const rightEdge = left + menuRect.width;
    if (rightEdge > window.innerWidth) {
      left = window.innerWidth - menuRect.width - 8;
    }
    if (left < 0) {
      left = 8;
    }

    // Position vertically below the trigger
    let top = triggerRect.bottom + sideOffset;

    // If it would go off the bottom, position above
    if (top + menuRect.height > window.innerHeight) {
      top = triggerRect.top - menuRect.height - sideOffset;
    }

    menuRef.current.style.top = `${top}px`;
    menuRef.current.style.left = `${left}px`;
  }, [open, align, sideOffset, menuRef, triggerRef]);

  // Handle mounting
  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[99999] min-w-[8rem] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-hidden rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
        className,
      )}
      role="menu"
      aria-orientation="vertical"
    >
      {children}
    </div>,
    document.body,
  );
}

interface CustomDropdownMenuItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void;
}

export function CustomDropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onSelect,
  onClick,
  children,
  ...props
}: CustomDropdownMenuItemProps) {
  const { setOpen } = useCustomDropdownMenu();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (onClick) onClick(e);

    if (onSelect) {
      onSelect();
    }

    // Close dropdown on item selection
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "focus:bg-accent dark:hover:bg-neutral-800 hover:bg-neutral-100 focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        disabled && "opacity-50 pointer-events-none",
        variant === "destructive" && "text-destructive",
        inset && "pl-8",
        className,
      )}
      role="menuitem"
      aria-disabled={disabled}
      onClick={handleClick}
      tabIndex={disabled ? -1 : 0}
      data-variant={variant}
      data-inset={inset}
      data-disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface CustomDropdownMenuSeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function CustomDropdownMenuSeparator({
  className,
  ...props
}: CustomDropdownMenuSeparatorProps) {
  return (
    <div
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      role="separator"
      {...props}
    />
  );
}

export { useCustomDropdownMenu };