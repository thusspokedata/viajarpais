"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";
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
 *
 * `buttonVariants` se exporta desde `./button-variants` (sin "use client")
 * para que Server Components puedan usarlo y estilizar `<Link>` con la
 * misma apariencia.
 */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
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
export type { ButtonVariantProps };
