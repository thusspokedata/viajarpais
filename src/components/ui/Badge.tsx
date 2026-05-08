"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ShieldCheck, Star } from "lucide-react";
import { cn } from "./cn";

/**
 * Badge — chip de estado / categoría.
 *
 * Variantes funcionales:
 * - default / info / success / warning / danger → estados.
 * - tier-free / tier-paid / tier-featured       → señalan el tier de la
 *   ficha en listings. Usar SOLO en cards de listing, nunca en otros
 *   contextos para no diluir el significado.
 * - verified                                    → sello institucional.
 *
 * Para el sello "Verificado" preferí <VerifiedBadge> que ya viene con el
 * icono y la microinteracción de hover.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 align-middle",
    "font-sans font-medium leading-none whitespace-nowrap",
    "rounded-[var(--radius-pill)]",
    "transition-[background-color,color,box-shadow] duration-[var(--duration-fast)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--neutral-150)] text-[var(--text-secondary)] border border-[var(--border-subtle)]",
        info: "bg-[var(--info-bg)] text-[var(--info-fg)]",
        success: "bg-[var(--success-bg)] text-[var(--success-fg)]",
        warning: "bg-[var(--warning-bg)] text-[var(--warning-fg)]",
        danger: "bg-[var(--danger-bg)] text-[var(--danger-fg)]",
        "tier-free":
          "bg-transparent text-[var(--text-muted)] border border-[var(--border-subtle)]",
        "tier-paid":
          "bg-[color-mix(in_oklch,var(--tier-paid-accent)_55%,white)] text-[var(--neutral-800)] border border-[var(--tier-paid-accent)]",
        "tier-featured":
          "bg-[var(--featured-bg)] text-[var(--featured-fg)] border border-[var(--featured-ring)] " +
          "shadow-[inset_0_-1px_0_0_color-mix(in_oklch,var(--featured-ring)_30%,transparent)]",
        verified: [
          "bg-[var(--verified-bg)] text-[var(--verified-fg)]",
          "border border-[color-mix(in_oklch,var(--verified-ring)_40%,transparent)]",
          "font-display tracking-[var(--tracking-caps)] uppercase",
        ].join(" "),
      },
      size: {
        sm: "text-[10px] h-5 px-2",
        md: "text-[var(--text-xs)] h-6 px-2.5",
        lg: "text-[var(--text-sm)] h-7 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

/* ─────────────────────────────────────────────────────────────
   FeaturedBadge — etiqueta sutil para fichas tier featured.
   No grita "DESTACADO" en mayúsculas con estrella amarilla.
   Es un wordmark editorial pequeño + estrella outline fina.
   ───────────────────────────────────────────────────────────── */
export function FeaturedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="tier-featured" size="md" className={cn("gap-1.5", className)}>
      <Star className="h-3 w-3" strokeWidth={2} aria-hidden />
      <span className="font-display tracking-[var(--tracking-caps)] uppercase text-[10px]">
        Selección
      </span>
    </Badge>
  );
}

/* ─────────────────────────────────────────────────────────────
   VerifiedBadge — sello institucional.

   Comportamiento por estado de verificación:
   - active   (vence en > 60 días) → verde institucional pleno.
   - expiring (vence en ≤ 60 días) → ring ámbar sutil + barrita.
   - expired                       → monocromatizado a gris.

   Hover: tooltip con fechas + barra de vigencia restante.
   El tooltip se renderiza con CSS puro para que el sello sea usable
   incluso fuera de un TooltipProvider.

   El badge es el ACTIVO DE MARCA crítico. NO cambies sin coordinar.
   ───────────────────────────────────────────────────────────── */
export type VerifiedStatus = "active" | "expiring" | "expired";

export interface VerifiedBadgeProps {
  /** ISO date string de cuándo vence la verificación. */
  expiresAt: string;
  /** ISO date string de cuándo se verificó (para tooltip). */
  verifiedAt: string;
  /** Tamaño visual. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Renderizar sin tooltip (e.g. dentro de Tooltip de Radix). */
  bareTooltip?: boolean;
}

function computeStatus(expiresAt: string): {
  status: VerifiedStatus;
  daysRemaining: number;
} {
  const now = Date.now();
  const expiryMs = new Date(expiresAt).getTime();
  const days = Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return { status: "expired", daysRemaining: days };
  if (days <= 60) return { status: "expiring", daysRemaining: days };
  return { status: "active", daysRemaining: days };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const VerifiedBadge = React.forwardRef<HTMLSpanElement, VerifiedBadgeProps>(
  ({ expiresAt, verifiedAt, size = "md", className, bareTooltip = false }, ref) => {
    const { status, daysRemaining } = computeStatus(expiresAt);

    const colorByStatus: Record<VerifiedStatus, string> = {
      active:
        "bg-[var(--verified-bg)] text-[var(--verified-fg)] " +
        "border border-[color-mix(in_oklch,var(--verified-ring)_45%,transparent)]",
      expiring:
        "bg-[var(--warning-bg)] text-[var(--warning-fg)] " +
        "border border-[color-mix(in_oklch,var(--warning-fg)_35%,transparent)]",
      expired:
        "bg-[var(--neutral-150)] text-[var(--neutral-500)] " +
        "border border-[var(--border-subtle)] grayscale",
    };

    const sizeClass = {
      sm: "text-[9px] h-5 px-2 gap-1",
      md: "text-[10px] h-6 px-2.5 gap-1.5",
      lg: "text-[11px] h-7 px-3 gap-1.5",
    }[size];

    const iconSize = { sm: 11, md: 12, lg: 14 }[size];

    /* Vigencia restante en porcentaje (12 meses = 365 días) */
    const totalWindow = 365;
    const pct = Math.max(0, Math.min(100, (daysRemaining / totalWindow) * 100));

    return (
      <span
        ref={ref}
        className={cn("relative inline-flex group/verified", className)}
        data-verified-status={status}
      >
        <span
          aria-label={
            status === "expired"
              ? `Verificación vencida el ${formatDate(expiresAt)}`
              : `Verificado por ViajarPaís — vence ${formatDate(expiresAt)}`
          }
          className={cn(
            "inline-flex items-center rounded-[var(--radius-pill)]",
            "font-display uppercase tracking-[var(--tracking-caps)] font-semibold",
            "select-none cursor-help",
            "transition-all duration-[var(--duration-base)] ease-[var(--ease-standard)]",
            "group-hover/verified:shadow-[var(--shadow-subtle)]",
            sizeClass,
            colorByStatus[status]
          )}
        >
          <ShieldCheck
            width={iconSize}
            height={iconSize}
            strokeWidth={2.25}
            aria-hidden
            className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover/verified:scale-110"
          />
          Verificado
        </span>

        {!bareTooltip ? (
          <span
            role="tooltip"
            className={cn(
              "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-50",
              "min-w-[220px] max-w-[260px] p-3 rounded-[var(--radius-md)]",
              "bg-[var(--neutral-900)] text-[var(--text-inverse)]",
              "shadow-[var(--shadow-elevated)]",
              "opacity-0 translate-y-1 scale-[0.98]",
              "transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-emphasized)]",
              "group-hover/verified:opacity-100 group-hover/verified:translate-y-0 group-hover/verified:scale-100",
              "group-focus-within/verified:opacity-100 group-focus-within/verified:translate-y-0"
            )}
          >
            <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[var(--tracking-caps)] opacity-80">
              <ShieldCheck size={12} />
              ViajarPaís
            </div>
            <div className="mt-1.5 text-[var(--text-sm)] leading-snug">
              {status === "expired"
                ? "Verificación vencida — en proceso de renovación."
                : "Información verificada manualmente por nuestro equipo editorial."}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] font-mono opacity-80">
              <div>
                <div className="opacity-60">Verificado</div>
                <div>{formatDate(verifiedAt)}</div>
              </div>
              <div>
                <div className="opacity-60">Vence</div>
                <div>{formatDate(expiresAt)}</div>
              </div>
            </div>
            {status !== "expired" ? (
              <div className="mt-2">
                <div className="h-1 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-[var(--duration-slow)]",
                      status === "expiring"
                        ? "bg-[var(--warning-fg)]"
                        : "bg-[var(--verified-ring)]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] opacity-70">
                  {daysRemaining} días restantes
                </div>
              </div>
            ) : null}
          </span>
        ) : null}
      </span>
    );
  }
);
VerifiedBadge.displayName = "VerifiedBadge";
