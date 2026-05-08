"use client";

import * as React from "react";
import { cn } from "./cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

/**
 * Input — campo de texto base.
 * Soporta leading/trailing icons. Estado `invalid` cambia border + focus ring.
 * El altura sigue --density-row-h para que el admin (compact) y el público
 * (comfortable) se vean correctos sin cambiar markup.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leadingIcon, trailingIcon, type = "text", ...props }, ref) => {
    if (leadingIcon || trailingIcon) {
      return (
        <div
          className={cn(
            "group relative flex items-center w-full rounded-[var(--radius-md)]",
            "bg-[var(--surface-base)] border transition-colors duration-[var(--duration-fast)]",
            invalid
              ? "border-[var(--danger-fg)]"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)]",
            "focus-within:border-[var(--brand-primary)]",
            "focus-within:shadow-[var(--shadow-focus)]"
          )}
        >
          {leadingIcon ? (
            <span className="pl-3 text-[var(--text-muted)] flex items-center">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            type={type}
            aria-invalid={invalid || undefined}
            className={cn(
              "flex-1 min-w-0 bg-transparent outline-none border-none",
              "h-[var(--density-row-h)] px-3",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "text-[var(--density-text-base)]",
              leadingIcon && "pl-2",
              trailingIcon && "pr-2",
              className
            )}
            {...props}
          />
          {trailingIcon ? (
            <span className="pr-3 text-[var(--text-muted)] flex items-center">
              {trailingIcon}
            </span>
          ) : null}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full h-[var(--density-row-h)] px-3 rounded-[var(--radius-md)]",
          "bg-[var(--surface-base)] border outline-none",
          "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          "text-[var(--density-text-base)]",
          "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
          invalid
            ? "border-[var(--danger-fg)] focus:shadow-[0_0_0_2px_var(--surface-canvas),0_0_0_4px_color-mix(in_oklch,var(--danger-fg)_50%,transparent)]"
            : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--brand-primary)] focus:shadow-[var(--shadow-focus)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
