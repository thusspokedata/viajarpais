"use client";

import * as React from "react";
import { cn } from "@/components/ui";
import type { AutosaveState } from "./useAutosave";

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "ahora";
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

/**
 * Indicador discreto de estado del autosave. Se actualiza solo cada
 * 15s para refrescar el "hace X seg" sin generar renders agresivos.
 */
export function SavedIndicator({ state }: { state: AutosaveState }) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    if (state.status !== "saved" || !state.lastSavedAt) return;
    const id = setInterval(() => force(), 15_000);
    return () => clearInterval(id);
  }, [state.status, state.lastSavedAt]);

  let label: string;
  let dotClass: string;
  if (state.status === "saving") {
    label = "Guardando…";
    dotClass = "bg-[var(--brand-primary)] animate-pulse";
  } else if (state.status === "error") {
    label = state.lastError ?? "Error guardando";
    dotClass = "bg-[var(--danger-fg)]";
  } else if (state.status === "saved" && state.lastSavedAt) {
    label = `Guardado ${formatRelative(state.lastSavedAt)}`;
    dotClass = "bg-[var(--success-fg)]";
  } else {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--text-muted)]"
      role="status"
      aria-live="polite"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />
      {label}
    </div>
  );
}
