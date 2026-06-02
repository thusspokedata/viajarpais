import * as React from "react";
import Image from "next/image";
import { cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/*
  <PlaceCard /> — pattern v0.4-a §7 del handoff.

  Card chica para subdivisiones geograficas dentro de un nivel:
  "Provincias adentro", "Departamentos adentro", "Localidades adentro".

  IMPORTANTE — es una SUBDIVISION GEOGRAFICA, NO una ficha. La
  diferenciacion con ListingCard es deliberada:

  |                  | PlaceCard (nuevo) | ListingCard (existente) |
  |------------------|-------------------|-------------------------|
  | aspect-ratio     | 3/2 (deliberado)  | 16/9 free/paid, 16/10   |
  |                  |                   | featured                |
  | Tipo             | subdivision geo   | ficha de directorio     |
  | Nombre           | Fraunces sobre la | dentro del cuerpo, con  |
  |                  | imagen (scrim)    | categoria arriba        |
  | Badges           | NINGUNO           | tier + Verificado       |
  | Metrica          | conteo + sub-niv  | ubicacion + descripcion |
  | Tamano           | chico (3-4/row)   | grande (2-3/row)        |
  | CTA              | card entera link  | "Ver ficha" boton       |

  3:2 vs 16:9/16:10 es contraste inmediato visual — el lector
  distingue "esto es un lugar geografico" vs "esto es una ficha"
  sin leer el contenido.

  Variantes:

  1. CON FOTO (default): <Image object-cover> 3:2 + scrim degradado
     abajo + nombre Fraunces blanco sobre el scrim. Meta debajo en
     el cuerpo de la card. Hover: media scale(1.04) (slower),
     card translateY(-3px) + shadow-default.

  2. SIN FOTO: placeholder a rayas del DS (mismo que ListingCard
     para consistencia visual entre los dos cards). Nombre Fraunces
     brand-700 sobre el placeholder. Label mono "sin foto aún"
     (override-able por prop noPhotoLabel para i18n).

  3. SIN FICHAS (listingCount === 0): border-style dashed (la card
     entera se ve "pendiente"), meta text-muted itálica. Combinable
     con/sin foto.

  Server Component — todo es markup + Link. Sin handlers.
*/

export interface PlaceCardProps {
  name: string;
  href: string;
  /**
   * URL Cloudinary (card variant ~600x400 recomendada). Null o
   * undefined -> variante sin foto.
   */
  imageUrl?: string | null;
  /**
   * Cantidad de fichas dentro de este sub-nivel. 0 dispara la
   * variante "Aún sin fichas" (border-dashed + meta italic muted).
   */
  listingCount: number;
  /**
   * Linea de meta ya localizada, ej. "12 fichas · 8 localidades"
   * o "Aún sin fichas". El componente NO sabe construirla — la
   * pagina la pasa armada por la regla de pluralizacion del locale.
   */
  metaText: string;
  /**
   * Alt text de la imagen (descripcion del lugar). Default: name.
   */
  imageAlt?: string;
  /**
   * Texto del label en la variante sin foto. Default "sin foto aún"
   * (es). Pasalo localizado desde la pagina para en/pt-BR.
   */
  noPhotoLabel?: string;
  className?: string;
}

export function PlaceCard({
  name,
  href,
  imageUrl,
  listingCount,
  metaText,
  imageAlt,
  noPhotoLabel = "sin foto aún",
  className,
}: PlaceCardProps) {
  const hasPhoto = typeof imageUrl === "string" && imageUrl.length > 0;
  const hasListings = listingCount > 0;
  const accessibleName = `${name}. ${metaText}`;

  return (
    <Link
      href={href}
      aria-label={accessibleName}
      className={cn(
        "group block overflow-hidden rounded-[var(--radius-md)]",
        "border bg-[var(--surface-base)]",
        // Variante sin fichas: dashed para comunicar "pendiente".
        hasListings
          ? "border-solid border-[var(--border-subtle)]"
          : "border-dashed border-[var(--border-strong)]",
        // Hover lift + shadow.
        "transition-all duration-[var(--duration-base)] ease-[var(--ease-standard)]",
        "hover:-translate-y-[3px] hover:shadow-[var(--shadow-default)]",
        // Focus ring.
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2",
        "focus-visible:ring-offset-[var(--surface-canvas)]",
        className,
      )}
    >
      {/* Media — 3:2 ratio diferencia inmediata vs ListingCard 16:9/10. */}
      <div className="relative w-full aspect-[3/2] overflow-hidden bg-[var(--surface-sunken)]">
        {hasPhoto ? (
          <>
            <Image
              src={imageUrl!}
              alt={imageAlt ?? name}
              fill
              sizes="(max-width: 420px) 100vw, (max-width: 760px) 50vw, 33vw"
              className={cn(
                "object-cover",
                // Hover: scale 1.04 con slower duration.
                "transition-transform duration-[var(--duration-slower)] ease-[var(--ease-standard)]",
                "group-hover:scale-[1.04]",
              )}
            />
            {/* Scrim degradado abajo. transparente arriba (58%) para
                no oscurecer la imagen. */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, oklch(12% 0.01 84 / 0.62), transparent 58%)",
              }}
            />
            {/* Nombre sobre el scrim, abajo-izquierda. Fraunces 600
                white tracking-tight. */}
            <h3
              className={cn(
                "absolute bottom-0 left-0 right-0",
                "px-[var(--space-4)] py-[var(--space-4)]",
                "font-display font-semibold",
                "text-[length:var(--text-lg)]",
                "text-white",
                "[letter-spacing:var(--tracking-tight)]",
                "[text-wrap:balance]",
              )}
            >
              {name}
            </h3>
          </>
        ) : (
          <>
            {/* Placeholder a rayas — mismo patron que ListingCard.
                Diagonal 135 deg, neutral-100/-150 stripes 8px. */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(135deg, var(--neutral-100) 0 8px, var(--neutral-150) 8px 16px)",
              }}
            />
            {/* Nombre brand-700 + label mono. Contenido apilado
                verticalmente y centrado sobre las rayas. */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-start justify-end",
                "px-[var(--space-4)] py-[var(--space-4)]",
              )}
            >
              <h3
                className={cn(
                  "font-display font-semibold",
                  "text-[length:var(--text-lg)]",
                  "text-[var(--brand-700)]",
                  "[letter-spacing:var(--tracking-tight)]",
                  "[text-wrap:balance]",
                )}
              >
                {name}
              </h3>
              <span
                className={cn(
                  "mt-[var(--space-1)]",
                  "font-mono text-[10px] uppercase",
                  "[letter-spacing:var(--tracking-caps)]",
                  "text-[var(--text-muted)]",
                )}
              >
                {noPhotoLabel}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Meta debajo del media — conteo + subdivision count. */}
      <div className={cn("px-[var(--space-4)] py-[var(--space-3)]")}>
        <p
          className={cn(
            "text-[length:var(--text-sm)]",
            // Variante sin fichas: muted italic. Con fichas: text-primary
            // weight 500 para el conteo + separator + sub-level secondary.
            hasListings
              ? "text-[var(--text-primary)] font-medium"
              : "italic text-[var(--text-muted)]",
          )}
        >
          {metaText}
        </p>
      </div>
    </Link>
  );
}

/* ---------- PlaceSection ---------- */

export interface PlaceSectionProps {
  /**
   * Titulo de la seccion (ej. "Provincias adentro"). Localizado por
   * la pagina.
   */
  title: string;
  /**
   * Eyebrow opcional (mayúsculas cortas, ej. "REGIÓN").
   */
  eyebrow?: string;
  /**
   * Cards (PlaceCard) o cualquier hijo a renderizar en el grid.
   */
  children: React.ReactNode;
  className?: string;
}

export function PlaceSection({
  title,
  eyebrow,
  children,
  className,
}: PlaceSectionProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[1120px]",
        "px-[var(--space-8)] py-[var(--space-10)]",
        className,
      )}
    >
      <header className="mb-[var(--space-6)]">
        {eyebrow && (
          <p
            className={cn(
              "font-display font-semibold uppercase",
              "text-[length:var(--text-sm)]",
              "[letter-spacing:var(--tracking-caps)]",
              "text-[var(--text-muted)] mb-[var(--space-2)]",
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={cn(
            "font-display font-semibold",
            "text-[length:var(--text-2xl)]",
            "[letter-spacing:var(--tracking-tight)]",
            "text-[var(--text-primary)]",
          )}
        >
          {title}
        </h2>
      </header>
      {/* Grid: 1 col mobile -> 2 a partir de 420 -> 3 a partir de 760.
          Breakpoints arbitrarios para matchear el handoff exacto. */}
      <div
        className={cn(
          "grid gap-[var(--space-4)]",
          "grid-cols-1",
          "min-[420px]:grid-cols-2",
          "min-[760px]:grid-cols-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}
