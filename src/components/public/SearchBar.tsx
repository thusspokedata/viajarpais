"use client";

import * as React from "react";
import { Search, MapPin, Layers } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * SearchBar — campo de búsqueda con dropdown de resultados.
 * Maneja flechas + Enter + Escape. Tres estados visualmente distintos:
 * - vacío con placeholder
 * - escribiendo con cursor visible
 * - con dropdown de resultados (3 sugerencias mock por ahora)
 */

export type SearchSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
  kind?: "listing" | "region" | "category";
};

export interface SearchBarProps {
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  onSelect?: (s: SearchSuggestion) => void;
  className?: string;
}

const DEFAULT_SUGGESTIONS: SearchSuggestion[] = [
  { id: "1", title: "Cabañas en Bariloche", subtitle: "Río Negro · Alojamiento", kind: "listing" },
  { id: "2", title: "Quebrada de Humahuaca", subtitle: "Jujuy · Sitio de interés", kind: "listing" },
  { id: "3", title: "Restaurantes en Mendoza", subtitle: "Mendoza · Gastronomía", kind: "category" },
];

export function SearchBar({
  placeholder = "Buscar lugares, regiones, categorías…",
  suggestions = DEFAULT_SUGGESTIONS,
  onSelect,
  className,
}: SearchBarProps) {
  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!value.trim()) return suggestions;
    const q = value.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.subtitle ?? "").toLowerCase().includes(q)
    );
  }, [value, suggestions]);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const pick = filtered[highlight];
      if (pick) {
        onSelect?.(pick);
        setValue(pick.title);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full", className)}
      data-state={open ? "open" : "closed"}
    >
      <div
        className={cn(
          "flex items-center gap-2 w-full",
          "h-11 px-4 rounded-[var(--radius-pill)]",
          "bg-[var(--surface-base)] border",
          "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
          open || value
            ? "border-[var(--brand-primary)] shadow-[var(--shadow-focus)]"
            : "border-[var(--border-default)] hover:border-[var(--border-strong)]"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-suggestions"
          role="combobox"
          className={cn(
            "flex-1 bg-transparent outline-none border-none",
            "text-[var(--text-base)] text-[var(--text-primary)]",
            "placeholder:text-[var(--text-muted)]"
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[var(--text-xs)]"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {open && filtered.length > 0 ? (
        <ul
          id="search-suggestions"
          role="listbox"
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-40",
            "bg-[var(--surface-raised)] rounded-[var(--radius-lg)]",
            "border border-[var(--border-subtle)] shadow-[var(--shadow-elevated)]",
            "p-1 overflow-hidden",
            "animate-[vp-reveal-down_var(--duration-fast)_var(--ease-decelerate)]"
          )}
        >
          {filtered.slice(0, 5).map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                onSelect?.(s);
                setValue(s.title);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                "rounded-[var(--radius-md)]",
                "transition-colors duration-[var(--duration-fast)]",
                i === highlight
                  ? "bg-[var(--surface-sunken)]"
                  : "hover:bg-[var(--surface-sunken)]"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                {s.kind === "region" ? (
                  <MapPin className="h-4 w-4" />
                ) : s.kind === "category" ? (
                  <Layers className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] truncate">
                  {s.title}
                </div>
                {s.subtitle ? (
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] truncate">
                    {s.subtitle}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
