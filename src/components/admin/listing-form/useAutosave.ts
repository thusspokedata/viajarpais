"use client";

import * as React from "react";

export type AutosaveState = {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: number | null;
  lastError: string | null;
};

/**
 * Autosave hook con coordinación contra submit manual.
 *
 * - Re-arma el timer cada vez que `data` cambia (se "resetea" mientras
 *   el editor sigue tipeando).
 * - No dispara si `enabled === false` o `isValid === false`.
 * - Cancela el request en flight cuando `cancelInFlight()` se llama
 *   (típicamente antes del submit manual).
 * - Last-write-wins via `requestId`: si llega tarde un response viejo,
 *   se descarta.
 *
 * No usa `setInterval` global — depende del ciclo de cambios + `setTimeout`
 * para sincronizarse con la actividad real del editor. Si el form deja
 * de cambiar, no corre autosave indefinidamente con el último snapshot.
 */
export function useAutosave<T>(args: {
  data: T;
  enabled: boolean;
  isValid: boolean;
  delayMs?: number;
  save: (data: T, signal: AbortSignal) => Promise<void>;
}) {
  const { data, enabled, isValid, delayMs = 30_000, save } = args;
  const [state, setState] = React.useState<AutosaveState>({
    status: "idle",
    lastSavedAt: null,
    lastError: null,
  });

  const reqIdRef = React.useRef(0);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  }, [save]);

  React.useEffect(() => {
    if (!enabled || !isValid) return;

    const handle = setTimeout(() => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const myId = ++reqIdRef.current;

      setState((s) => ({ ...s, status: "saving", lastError: null }));
      void saveRef
        .current(data, ctrl.signal)
        .then(() => {
          if (myId !== reqIdRef.current) return;
          setState({
            status: "saved",
            lastSavedAt: Date.now(),
            lastError: null,
          });
        })
        .catch((err: unknown) => {
          if (myId !== reqIdRef.current) return;
          if (err instanceof Error && err.name === "AbortError") {
            setState((s) => ({ ...s, status: "idle" }));
            return;
          }
          setState({
            status: "error",
            lastSavedAt: state.lastSavedAt,
            lastError:
              err instanceof Error ? err.message : "Error guardando.",
          });
        });
    }, delayMs);

    return () => clearTimeout(handle);
  }, [data, enabled, isValid, delayMs, state.lastSavedAt]);

  const cancelInFlight = React.useCallback(() => {
    ctrlRef.current?.abort();
    reqIdRef.current += 1;
  }, []);

  return { state, cancelInFlight };
}
