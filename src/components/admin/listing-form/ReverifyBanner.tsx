import { AlertTriangle } from "@/components/ui/icons";

/**
 * Banner ámbar que aparece cuando una ficha que estaba verificada se
 * editó en alguno de los campos críticos (name, address, geografía,
 * categorías) y por eso `verifiedAt` se reseteó. Sale del lado server.
 */
export function ReverifyBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--warning-fg)]/30 bg-[var(--warning-bg)] px-4 py-3"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--warning-fg)] mt-0.5" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="font-display text-[var(--text-sm)] font-semibold text-[var(--warning-fg)]">
          Esta ficha necesita re-verificación
        </div>
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)] leading-[var(--leading-normal)]">
          Cambiaron campos críticos (nombre, dirección, geografía o
          categorías) desde la última verificación. Re-auditá la ficha
          en persona y volvé a marcarla como verificada antes de publicarla.
        </p>
      </div>
    </div>
  );
}
