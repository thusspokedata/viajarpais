"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "./cn";

/**
 * Tabs — wrapper sobre Radix Tabs.
 * El indicador animado vive como `::after` en data-state=active del trigger,
 * con transition de width/transform; ver clases en TabsTrigger.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex items-center gap-1",
      "border-b border-[var(--border-subtle)]",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center",
      "px-3 py-2 text-[var(--text-sm)] font-medium",
      "text-[var(--text-secondary)]",
      "transition-colors duration-[var(--duration-fast)]",
      "hover:text-[var(--text-primary)]",
      "data-[state=active]:text-[var(--text-primary)]",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      "after:absolute after:inset-x-2 after:-bottom-px after:h-[2px]",
      "after:rounded-t-[2px] after:bg-[var(--brand-primary)]",
      "after:scale-x-0 after:transition-transform after:duration-[var(--duration-base)] after:ease-[var(--ease-emphasized)]",
      "after:origin-center",
      "data-[state=active]:after:scale-x-100",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4",
      "data-[state=active]:animate-[vp-fade-in_var(--duration-base)_var(--ease-decelerate)]",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
