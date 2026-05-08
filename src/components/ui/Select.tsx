"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

/**
 * Select — single value, basado en Radix Select.
 * Reusa los mismos border/focus/transition tokens que Input para que
 * un form alternando inputs y selects no tenga saltos visuales.
 */

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    invalid?: boolean;
  }
>(({ className, children, invalid, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex w-full items-center justify-between gap-2",
      "h-[var(--density-row-h)] px-3 rounded-[var(--radius-md)]",
      "bg-[var(--surface-base)] border outline-none",
      "text-[var(--text-primary)] text-[var(--density-text-base)]",
      "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
      "data-[placeholder]:text-[var(--text-muted)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      invalid
        ? "border-[var(--danger-fg)]"
        : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--brand-primary)] focus:shadow-[var(--shadow-focus)]",
      "[&>span]:line-clamp-1 [&>span]:text-left",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-50 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)]",
        "bg-[var(--surface-raised)] shadow-[var(--shadow-elevated)]",
        "min-w-[8rem] max-h-96",
        "data-[state=open]:animate-[vp-reveal-down_var(--duration-fast)_var(--ease-decelerate)]",
        "data-[state=closed]:opacity-0",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2",
      "rounded-[var(--radius-sm)] py-1.5 pl-8 pr-2",
      "text-[var(--text-sm)] outline-none",
      "data-[highlighted]:bg-[var(--surface-sunken)] data-[highlighted]:text-[var(--text-primary)]",
      "data-[state=checked]:font-medium",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "py-1.5 px-2 text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]",
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-[var(--border-subtle)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
