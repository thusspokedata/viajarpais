import * as React from "react";
import { ChevronLeft } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/components/ui";

/*
  <Breadcrumbs /> — pattern v0.4-a (handoff §2).

  Sirve a las 4 paginas geograficas publicas. Es Server Component:
  todo el contenido es links + texto, sin estado ni efectos. La
  variante mobile (truncado al medio en <420px, colapso a back-link
  en <360px) se resuelve con clases responsive de Tailwind v4
  (`hidden`/`flex` por breakpoint), sin hooks de viewport.

  Regla de posicion (decision cerrada en el handoff):
  - Hay foto en el hero  -> breadcrumbs DENTRO del GeoHero,
    variant="photo" (texto blanco con text-shadow sobre scrim).
  - No hay foto         -> breadcrumbs ENCIMA del hero, sobre
    surface-canvas, variant="canvas".

  El GeoHero decide donde montarlos cuando hay foto (paso por props
  + render interno). Cuando no hay foto, la pagina los monta ARRIBA
  del hero.

  Mobile:
  - ≤ 420px: trunca al medio -> primer item + "…" + padre + actual.
    El "…" NO es clickeable (handoff dice opcional para v0.4-b).
  - ≤ 360px: colapsa a "‹ {padre inmediato}" — un solo back-link.

  Implementacion CSS-only con clases responsive:
  - .breadcrumbs__full: visible >=420px
  - .breadcrumbs__truncated: visible 360px–419px
  - .breadcrumbs__compact: visible <360px

  Accesibilidad:
  - <nav aria-label="..."> envolvente con label localizable.
  - <ol> con <li>, semantica correcta.
  - Ultimo item: aria-current="page", sin <a> (no clickeable).
  - Separadores con aria-hidden.
*/

export interface Crumb {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  variant?: "canvas" | "photo";
  /**
   * Label localizado para el <nav aria-label>. Para componer desde
   * pagina: `t("Public.breadcrumbsLabel")`. Default "Migas de pan"
   * para uso ES sin pasar prop.
   */
  ariaLabel?: string;
  /**
   * Formatter localizado para el aria-label del back-link compacto
   * (mobile <360px). Recibe el nombre del padre. Default ES.
   * Componer desde pagina: `(name) => t("Public.breadcrumbBack", { name })`.
   */
  backLabel?: (parentName: string) => string;
  className?: string;
}

export function Breadcrumbs({
  items,
  variant = "canvas",
  ariaLabel = "Migas de pan",
  backLabel = (name) => `Volver a ${name}`,
  className,
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const last = items[items.length - 1];
  const parent = items.length >= 2 ? items[items.length - 2] : null;

  // Para la variante mobile <420px (truncada al medio):
  // [primer, ..., padre, actual] cuando items.length >= 4
  // Cuando items.length <= 3, la full vista ya cabe — no truncamos
  const showTruncated = items.length >= 4;
  const first = items[0];

  const isPhoto = variant === "photo";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        // Contenedor base: padding superior/inferior modesto, ancho
        // alineado con el hero (max-width 1120px). En variante canvas
        // agregamos border-bottom sutil; en photo NO porque flota
        // sobre la imagen.
        "w-full",
        isPhoto
          ? "px-[var(--space-6)] py-[var(--space-3)]"
          : "border-b border-[var(--border-subtle)] px-[var(--space-6)] py-[var(--space-3)]",
        className,
      )}
    >
      <div className="mx-auto max-w-[1120px]">
        {/* Vista FULL — visible >=420px */}
        <ol
          className={cn(
            "items-center gap-1 text-[length:var(--text-sm)] hidden min-[420px]:flex",
            isPhoto
              ? "[text-shadow:0_1px_8px_oklch(0%_0_0_/_0.4)]"
              : "",
          )}
        >
          {items.map((crumb, i) => {
            const isLast = i === items.length - 1;
            return (
              <BreadcrumbItem
                key={`${crumb.href}-full-${i}`}
                crumb={crumb}
                isLast={isLast}
                isPhoto={isPhoto}
                withSeparator={i > 0}
              />
            );
          })}
        </ol>

        {/* Vista TRUNCATED — visible 360-419px solo si items >= 4 */}
        {showTruncated && (
          <ol
            className={cn(
              "items-center gap-1 text-[length:var(--text-sm)] hidden min-[360px]:flex min-[420px]:hidden",
              isPhoto
                ? "[text-shadow:0_1px_8px_oklch(0%_0_0_/_0.4)]"
                : "",
            )}
          >
            <BreadcrumbItem
              crumb={first}
              isLast={false}
              isPhoto={isPhoto}
              withSeparator={false}
            />
            <BreadcrumbEllipsis isPhoto={isPhoto} />
            {parent && (
              <BreadcrumbItem
                crumb={parent}
                isLast={false}
                isPhoto={isPhoto}
                withSeparator={true}
              />
            )}
            <BreadcrumbItem
              crumb={last}
              isLast={true}
              isPhoto={isPhoto}
              withSeparator={true}
            />
          </ol>
        )}

        {/* Vista COMPACT — visible <360px, o si items <=3 no
            mostramos truncated y la full se oculta abajo de 420.
            En este caso volvemos al back-link como fallback. */}
        <div
          className={cn(
            "items-center text-[length:var(--text-sm)] flex min-[360px]:hidden",
            !showTruncated && "max-[419px]:flex min-[420px]:hidden",
            isPhoto
              ? "[text-shadow:0_1px_8px_oklch(0%_0_0_/_0.4)]"
              : "",
          )}
        >
          {parent ? (
            <Link
              href={parent.href}
              className={cn(
                "inline-flex items-center gap-1 px-[6px] py-[3px] rounded-[var(--radius-xs)] transition-colors duration-[var(--duration-fast)]",
                isPhoto
                  ? "text-[oklch(100%_0_0_/_0.82)] hover:text-white hover:underline underline-offset-2"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline underline-offset-2",
              )}
              aria-label={backLabel(parent.label)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>{parent.label}</span>
            </Link>
          ) : (
            // Si no hay padre (region como único item), mostramos el
            // único item sin link, marcado como actual.
            <span
              aria-current="page"
              className={cn(
                "px-[6px] py-[3px] font-medium",
                isPhoto ? "text-white" : "text-[var(--text-primary)]",
              )}
            >
              {last.label}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

function BreadcrumbItem({
  crumb,
  isLast,
  isPhoto,
  withSeparator,
}: {
  crumb: Crumb;
  isLast: boolean;
  isPhoto: boolean;
  withSeparator: boolean;
}) {
  return (
    <>
      {withSeparator && <BreadcrumbSeparator isPhoto={isPhoto} />}
      <li className="inline-flex items-center">
        {isLast ? (
          <span
            aria-current="page"
            className={cn(
              "px-[6px] py-[3px] font-medium",
              isPhoto ? "text-white" : "text-[var(--text-primary)]",
            )}
          >
            {crumb.label}
          </span>
        ) : (
          <Link
            href={crumb.href}
            className={cn(
              "px-[6px] py-[3px] rounded-[var(--radius-xs)] transition-colors duration-[var(--duration-fast)] underline-offset-2 hover:underline",
              isPhoto
                ? "text-[oklch(100%_0_0_/_0.82)] hover:text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {crumb.label}
          </Link>
        )}
      </li>
    </>
  );
}

function BreadcrumbSeparator({ isPhoto }: { isPhoto: boolean }) {
  return (
    <li
      aria-hidden="true"
      className={cn(
        "select-none opacity-50 px-[2px]",
        isPhoto ? "text-white" : "text-[var(--text-muted)]",
      )}
    >
      ›
    </li>
  );
}

function BreadcrumbEllipsis({ isPhoto }: { isPhoto: boolean }) {
  return (
    <>
      <BreadcrumbSeparator isPhoto={isPhoto} />
      <li
        aria-hidden="true"
        className={cn(
          "select-none px-[6px] py-[3px]",
          isPhoto
            ? "text-[oklch(100%_0_0_/_0.6)]"
            : "text-[var(--text-muted)]",
        )}
      >
        …
      </li>
    </>
  );
}
