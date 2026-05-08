"use client";

import * as React from "react";
import { cn } from "./cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Si true, animación shimmer suave; si false, color sólido (placeholder). */
  shimmer?: boolean;
}

/**
 * Skeleton — placeholder de carga.
 * Por defecto usa shimmer suave; respeta prefers-reduced-motion (definido
 * globalmente en globals.css).
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, shimmer = true, ...props }, ref) => (
    <div
      ref={ref}
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "rounded-[var(--radius-md)]",
        shimmer ? "vp-shimmer" : "bg-[var(--neutral-150)]",
        className
      )}
      {...props}
    />
  )
);
Skeleton.displayName = "Skeleton";
