"use client";

import * as React from "react";
import { cn } from "./cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full min-h-24 rounded-[var(--radius-md)] px-3 py-2",
          "bg-[var(--surface-base)] border outline-none resize-y",
          "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          "text-[var(--density-text-base)] leading-[var(--leading-normal)]",
          "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
          invalid
            ? "border-[var(--danger-fg)]"
            : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--brand-primary)] focus:shadow-[var(--shadow-focus)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
