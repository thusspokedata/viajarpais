"use client";

import * as React from "react";
import { cn } from "@/components/ui";

/**
 * RegionFilter — chips para las 6 regiones argentinas.
 *
 * Decisión: chips horizontales con scroll en mobile, no tabs ni list.
 * Razón: en el directorio el usuario suele filtrar por región como acción
 * rápida desde cualquier punto del listado, y las tabs implican
 * exclusividad estricta. Los chips además permiten estado "ninguno
 * seleccionado" (= todas las regiones), que es nuestro default.
 */

export const REGIONS = [
  { id: "all", label: "Todas las regiones", short: "Todas" },
  { id: "cuyo", label: "Cuyo", short: "Cuyo" },
  { id: "noa", label: "NOA", short: "NOA" },
  { id: "nea", label: "NEA", short: "NEA" },
  { id: "patagonia", label: "Patagonia", short: "Patagonia" },
  { id: "pampeana", label: "Pampeana", short: "Pampeana" },
  { id: "centro", label: "Centro", short: "Centro" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export interface RegionFilterProps {
  value?: RegionId;
  onChange?: (value: RegionId) => void;
  disabled?: boolean;
  className?: string;
}

export function RegionFilter({
  value = "all",
  onChange,
  disabled,
  className,
}: RegionFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Filtrar por región"
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {REGIONS.map((region) => {
        const active = region.id === value;
        return (
          <button
            key={region.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange?.(region.id)}
            className={cn(
              "inline-flex items-center px-3.5 py-1.5",
              "rounded-[var(--radius-pill)]",
              "text-[var(--text-sm)] font-medium",
              "border transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
              "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
              active
                ? "bg-[var(--text-primary)] text-[var(--text-inverse)] border-transparent shadow-[var(--shadow-subtle)]"
                : "bg-[var(--surface-base)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:-translate-y-[1px]"
            )}
          >
            {region.label}
          </button>
        );
      })}
    </div>
  );
}
