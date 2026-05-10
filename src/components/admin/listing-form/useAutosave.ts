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
 * - Si recibe `validate`, lo invoca DESPUÉS del debounce y ANTES de
 *   `save()`. Si retorna `false`, el autosave se aborta silenciosamente
 *   (status pasa a `idle`). Esto cubre el gap de `mode: "onBlur"` en
 *   RHF: `isValid` no se actualiza durante el typing, así que el flag
 *   puede estar stale cuando el timer dispara. `validate` (típicamente
 *   `form.trigger`) fuerza una revalidación fresca contra el resolver y
 *   además hace visibles los errores en pantalla — el editor ve qué
 *   corregir en lugar de un "Error al guardar" genérico.
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
  validate?: () => Promise<boolean>;
}) {
  const { data, enabled, isValid, delayMs = 30_000, save, validate } = args;
  const [state, setState] = React.useState<AutosaveState>({
    status: "idle",
    lastSavedAt: null,
    lastError: null,
  });

  const reqIdRef = React.useRef(0);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const saveRef = React.useRef(save);
  const validateRef = React.useRef(validate);
  React.useEffect(() => {
    saveRef.current = save;
  }, [save]);
  React.useEffect(() => {
    validateRef.current = validate;
  }, [validate]);

  /*
    `state.lastSavedAt` NO entra en el dep array a propósito. Si lo
    incluyera, cada save exitoso re-armaría el timer y dispararía un
    nuevo autosave inmediatamente — autosaves más frecuentes que los
    `delayMs` configurados. Para preservar el timestamp en el branch de
    error usamos un updater functional (`setState((s) => ...)`) que lee
    el valor anterior sin necesidad de tenerlo como dependencia.
  */
  React.useEffect(() => {
    if (!enabled || !isValid) return;

    const handle = setTimeout(async () => {
      /*
        Revalidación fresca contra el resolver. RHF con `mode: "onBlur"`
        no recalcula `isValid` durante el typing — el flag puede haber
        quedado en `true` desde un blur anterior, aunque la data actual
        sea inválida. Llamar a `validate` (típicamente `form.trigger`)
        fuerza el chequeo ahora y, como side-effect, muestra los errores
        de campo si los hay.
      */
      if (validateRef.current) {
        const valid = await validateRef.current();
        if (!valid) {
          setState((s) => ({ ...s, status: "idle" }));
          return;
        }
      }

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
          setState((s) => ({
            status: "error",
            lastSavedAt: s.lastSavedAt,
            lastError:
              err instanceof Error ? err.message : "Error guardando.",
          }));
        });
    }, delayMs);

    return () => clearTimeout(handle);
  }, [data, enabled, isValid, delayMs]);

  const cancelInFlight = React.useCallback(() => {
    ctrlRef.current?.abort();
    reqIdRef.current += 1;
  }, []);

  return { state, cancelInFlight };
}
