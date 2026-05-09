"use client";

import * as React from "react";
import { Check, Star } from "lucide-react";
import { cn } from "@/components/ui";
import type { CategoryOption } from "./types";

export type CategoryEntry = { categoryId: string; isPrimary: boolean };

/**
 * Multi-select de categorías con flag `isPrimary`.
 *
 * Cada categoría es un row con:
 * - Checkbox para seleccionar/deseleccionar.
 * - Botón "Estrella" para marcarla como principal. Solo una puede ser
 *   principal a la vez — al elegir una nueva, la anterior pierde el
 *   flag automáticamente.
 *
 * Reglas:
 * - Si solo hay una seleccionada, es automáticamente la principal.
 * - Si la principal se deselecciona, la próxima elegida pasa a serlo
 *   (o queda sin principal si no quedan otras — la validación zod
 *   exige exactamente 1 principal al submit).
 */
export function CategoryMultiSelect({
  categories,
  value,
  onChange,
  error,
}: {
  categories: CategoryOption[];
  value: CategoryEntry[];
  onChange: (next: CategoryEntry[]) => void;
  error?: string;
}) {
  const selectedIds = new Set(value.map((v) => v.categoryId));

  function toggle(categoryId: string) {
    if (selectedIds.has(categoryId)) {
      const filtered = value.filter((v) => v.categoryId !== categoryId);
      // Si quedó alguna sin primary y había una sola antes seleccionada,
      // promover la primera a primary. Reconstruimos el array sin mutar
      // los entries (eran derivados del form state — mutarlos genera
      // estados inconsistentes en RHF).
      const needsPromotion =
        filtered.length > 0 && !filtered.some((v) => v.isPrimary);
      const next = needsPromotion
        ? filtered.map((v, i) => (i === 0 ? { ...v, isPrimary: true } : v))
        : filtered;
      onChange(next);
    } else {
      const next = [...value, { categoryId, isPrimary: value.length === 0 }];
      onChange(next);
    }
  }

  function setPrimary(categoryId: string) {
    if (!selectedIds.has(categoryId)) {
      // Selecciona y marca como primary en un solo paso.
      onChange([
        ...value.map((v) => ({ ...v, isPrimary: false })),
        { categoryId, isPrimary: true },
      ]);
      return;
    }
    onChange(
      value.map((v) => ({ ...v, isPrimary: v.categoryId === categoryId })),
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <ul
        role="listbox"
        aria-multiselectable
        className="grid sm:grid-cols-2 gap-1.5"
      >
        {categories.map((cat) => {
          const selected = selectedIds.has(cat.id);
          const isPrimary =
            value.find((v) => v.categoryId === cat.id)?.isPrimary ?? false;
          return (
            <li
              key={cat.id}
              role="option"
              aria-selected={selected}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border transition-colors",
                selected
                  ? "border-[var(--brand-primary)] bg-[var(--brand-muted)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--surface-base)]",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left focus:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-[var(--radius-sm)]"
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    "grid place-items-center h-4 w-4 rounded-[var(--radius-xs)] border shrink-0",
                    selected
                      ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--brand-primary-fg)]"
                      : "border-[var(--border-default)] bg-[var(--surface-base)]",
                  )}
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="text-[var(--text-sm)] text-[var(--text-primary)] truncate">
                  {cat.nameEs}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPrimary(cat.id)}
                aria-pressed={isPrimary}
                aria-label={
                  isPrimary
                    ? `Categoría principal: ${cat.nameEs}`
                    : `Marcar ${cat.nameEs} como categoría principal`
                }
                title={
                  isPrimary
                    ? "Categoría principal"
                    : "Marcar como categoría principal"
                }
                className={cn(
                  "h-7 w-7 grid place-items-center rounded-[var(--radius-sm)] shrink-0",
                  "transition-colors focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                  isPrimary
                    ? "bg-[var(--featured-bg)] text-[var(--featured-fg)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
                )}
              >
                <Star
                  className="h-4 w-4"
                  fill={isPrimary ? "currentColor" : "none"}
                />
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <div className="text-[var(--text-xs)] text-[var(--danger-fg)] mt-1">
          {error}
        </div>
      ) : null}
      <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
        Marcá <Star className="inline h-3 w-3 align-text-top" /> en una para fijarla como
        principal. La principal aparece como categoría primaria en la URL pública.
      </p>
    </div>
  );
}
