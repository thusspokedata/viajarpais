"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "./cn";

/**
 * Label — wrapper sobre Radix Label. Estilo consistente con Input.
 * Soporta `requiredMark` para mostrar un asterisco discreto.
 */
export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  requiredMark?: boolean;
  hint?: string;
}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, children, requiredMark, hint, ...props }, ref) => (
  <div className="flex items-baseline justify-between gap-3">
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-[var(--text-sm)] font-medium text-[var(--text-primary)]",
        "leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {requiredMark ? (
        <span aria-hidden className="ml-1 text-[var(--danger-fg)]">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
    {hint ? (
      <span className="text-[var(--text-xs)] text-[var(--text-muted)]">{hint}</span>
    ) : null}
  </div>
));
Label.displayName = "Label";
