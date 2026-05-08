"use client";

import * as React from "react";
import { ChevronDown } from "@/components/ui/icons";
import { cn } from "@/components/ui";

/**
 * Wrapper colapsable para cada sección del form. Por default expandida o
 * colapsada según `defaultOpen`. Mantiene su propio estado pero acepta
 * un control externo opcional (para "expandir todo" / "colapsar todo").
 *
 * El children siempre se monta — solo se oculta con `hidden` para no
 * perder el estado del form ni desconectar los inputs de react-hook-form.
 */
export function FormSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between gap-4 px-5 py-4 text-left",
          "rounded-[var(--radius-lg)] focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        )}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[var(--text-md)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
              {title}
            </span>
            {badge}
          </div>
          {description ? (
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-normal)]">
              {description}
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-[var(--duration-fast)]",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      <div
        hidden={!open}
        className="px-5 pb-5 pt-1 border-t border-[var(--border-subtle)]"
      >
        <div className="flex flex-col gap-4 pt-3">{children}</div>
      </div>
    </section>
  );
}

export function FieldRow({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]"
        >
          {label}
          {required ? (
            <span className="text-[var(--danger-fg)] ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </label>
        {hint ? (
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <div className="text-[var(--text-xs)] text-[var(--danger-fg)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
