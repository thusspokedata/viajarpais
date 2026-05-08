"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/**
 * Button — primitivo base.
 *
 * Reglas:
 * - `primary`     → CTA principal, una sola por pantalla idealmente.
 * - `secondary`   → acción secundaria al lado del primary.
 * - `ghost`       → acción terciaria, en toolbars / row actions.
 * - `destructive` → eliminar / cancelar de forma irreversible.
 * - `link`        → cuando la acción se siente como navegación.
 *
 * Tamaños sm/md/lg. Hover: lift sutil + cambio tonal. Press: scale 0.98.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-medium select-none",
    "rounded-[var(--radius-md)]",
    "transition-[transform,background-color,color,box-shadow,border-color]",
    "duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.985]",
    "focus-visible:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]",
          "shadow-[var(--shadow-subtle)]",
          "hover:bg-[var(--brand-primary-hover)] hover:shadow-[var(--shadow-default)] hover:-translate-y-[1px]",
          "active:bg-[var(--brand-primary-active)] active:translate-y-0",
        ].join(" "),
        secondary: [
          "bg-[var(--surface-base)] text-[var(--text-primary)]",
          "border border-[var(--border-default)]",
          "hover:bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]",
          "active:bg-[var(--neutral-150)]",
        ].join(" "),
        ghost: [
          "bg-transparent text-[var(--text-secondary)]",
          "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
          "active:bg-[var(--neutral-150)]",
        ].join(" "),
        destructive: [
          "bg-[var(--danger-fg)] text-[var(--neutral-0)]",
          "hover:opacity-90 hover:-translate-y-[1px]",
          "active:translate-y-0",
        ].join(" "),
        link: [
          "bg-transparent text-[var(--text-link)] px-0 h-auto",
          "hover:text-[var(--text-link-hover)] hover:underline underline-offset-4",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-[var(--text-sm)]",
        md: "h-10 px-4 text-[var(--text-base)]",
        lg: "h-12 px-6 text-[var(--text-md)]",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
