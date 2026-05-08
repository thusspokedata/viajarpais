"use client";

import * as React from "react";
import { cn } from "./cn";
import { Button, type ButtonProps } from "./Button";

/**
 * EmptyState — pattern reusable para "no hay nada acá".
 *
 * Casos: filtros sin resultados, admin sin fichas, región sin contenido.
 * Composición: icono opcional + título + descripción + CTA opcional.
 *
 * Personalidad sin caer en ilustraciones AI: contorno geométrico simple,
 * tipografía display para el título, micro-animación al montar.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "vp-fade-in flex flex-col items-center justify-center text-center",
        "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)]",
        "bg-[var(--surface-canvas)]",
        {
          sm: "py-8 px-6 gap-2",
          md: "py-12 px-8 gap-3",
          lg: "py-20 px-10 gap-4",
        }[size],
        className
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full",
            "bg-[var(--surface-sunken)] text-[var(--text-muted)]",
            "border border-[var(--border-subtle)]",
            {
              sm: "h-10 w-10",
              md: "h-14 w-14",
              lg: "h-16 w-16",
            }[size]
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3
        className={cn(
          "font-display font-semibold text-[var(--text-primary)] tracking-[var(--tracking-tight)]",
          {
            sm: "text-[var(--text-md)]",
            md: "text-[var(--text-xl)]",
            lg: "text-[var(--text-2xl)]",
          }[size]
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "max-w-md text-[var(--text-secondary)] leading-[var(--leading-normal)]",
            {
              sm: "text-[var(--text-sm)]",
              md: "text-[var(--text-base)]",
              lg: "text-[var(--text-md)]",
            }[size]
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Variante atajo para casos comunes con un botón. */
export function EmptyStateAction(props: ButtonProps) {
  return <Button {...props} />;
}
