"use client";

import * as React from "react";
import { Filter, LayoutGrid, List, Map } from "@/components/ui/icons";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Card,
  Separator,
  cn,
} from "@/components/ui";
import { ListingCard, type ListingCardProps } from "./ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * ListingsLayout — grid principal del directorio público.
 * Sidebar de filtros + barra superior con conteo + ordenamiento + view-toggle.
 * Empty state + loading state con skeletons listos.
 */

export interface ListingsLayoutProps {
  listings: ListingCardProps[];
  total?: number;
  loading?: boolean;
  filtersSlot?: React.ReactNode;
  className?: string;
}

export function ListingsLayout({
  listings,
  total,
  loading = false,
  filtersSlot,
  className,
}: ListingsLayoutProps) {
  const [sort, setSort] = React.useState("relevance");
  const [view, setView] = React.useState<"grid" | "list">("grid");

  return (
    <div className={cn("mx-auto max-w-7xl px-4 md:px-6 py-8", className)}>
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Sidebar filters */}
        <aside className="hidden md:block">
          <Card className="p-5 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[var(--text-md)] font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </h2>
              <button className="text-[var(--text-xs)] text-[var(--text-link)] hover:underline">
                Limpiar
              </button>
            </div>
            {filtersSlot ?? <DefaultFilters />}
          </Card>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {total ?? listings.length}
                  </span>{" "}
                  fichas encontradas
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] p-0.5">
                <ViewToggleButton
                  active={view === "grid"}
                  onClick={() => setView("grid")}
                  icon={<LayoutGrid className="h-4 w-4" />}
                  label="Grid"
                />
                <ViewToggleButton
                  active={view === "list"}
                  onClick={() => setView("list")}
                  icon={<List className="h-4 w-4" />}
                  label="Lista"
                />
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Más relevantes</SelectItem>
                  <SelectItem value="name">Por nombre (A→Z)</SelectItem>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="featured">Destacados primero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid / list / empty / loading */}
          {loading ? (
            <div className={cn("grid gap-5", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingSkeleton key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<Map className="h-6 w-6" />}
              title="No encontramos fichas con esos filtros"
              description="Probá ampliando la región o quitando algún filtro. También podés explorar por categoría."
              action={<Button variant="secondary">Limpiar filtros</Button>}
            />
          ) : (
            <div
              className={cn(
                "grid gap-5",
                view === "grid"
                  ? "md:grid-cols-2 xl:grid-cols-3 [&>[data-tier=featured]]:xl:col-span-2"
                  : "grid-cols-1"
              )}
            >
              {listings.map((l, i) => (
                <ListingCard key={i} {...l} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "h-8 w-8 grid place-items-center rounded-[var(--radius-sm)]",
        "transition-colors duration-[var(--duration-fast)]",
        active
          ? "bg-[var(--surface-sunken)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
    </button>
  );
}

function ListingSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="p-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full mt-1" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </Card>
  );
}

function DefaultFilters() {
  return (
    <div className="flex flex-col gap-5">
      <FilterGroup
        label="Categoría"
        options={["Alojamientos", "Gastronomía", "Excursiones", "Eventos", "Sitios de interés", "Spas y termas"]}
      />
      <Separator />
      <FilterGroup
        label="Provincia"
        options={["Mendoza", "San Juan", "San Luis", "Salta", "Jujuy", "Tucumán"]}
      />
      <Separator />
      <FilterGroup label="Verificación" options={["Solo verificados", "Verificación reciente"]} />
    </div>
  );
}

function FilterGroup({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] mb-2">
        {label}
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded-[var(--radius-xs)] border-[var(--border-default)] accent-[var(--brand-primary)]"
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}
