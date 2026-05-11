"use client";

import { Toaster } from "sonner";

/*
  Toaster del admin. Wrap mínimo para colocar el mount en el layout
  server-side sin que el layout pase a Client Component completo.
  Tokens del design system aplicados via `toastOptions` y `className` —
  no usamos los colores default de Sonner para mantener consistencia.
*/

export function AdminToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={6_000}
      toastOptions={{
        classNames: {
          toast:
            "rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[var(--shadow-elevated)]",
        },
      }}
    />
  );
}
