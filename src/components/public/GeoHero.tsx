import * as React from "react";
import { cn } from "@/components/ui";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { HeroPhotoImage } from "./HeroPhotoImage";

/*
  <GeoHero /> — pattern v0.4-a §1 del handoff.

  Hero comun de las 4 paginas geograficas publicas (region /
  province / department / locality). Server Component — no necesita
  estado ni handlers. El trigger de galeria (si vive en el hero)
  llega como slot ReactNode desde la pagina (donde se compone con
  GalleryProvider del PhotoGallery client component).

  Dos variantes radicalmente distintas:

  CON FOTO (full-bleed):
  - <img object-cover> ocupa todo el hero.
  - Scrim degradado oscuro abajo para contraste AA del texto blanco.
  - Breadcrumbs adentro (variant="photo", text-shadow).
  - Eyebrow + h1 abajo-izquierda sobre el scrim.
  - Trigger galeria abajo-derecha (glassmorph) si hay > 1 imagen.
  - Banda editorial brand-50 DEBAJO del hero con el tagline.

  SIN FOTO (tipografico):
  - Fondo brand-50 con watermark gigante de la inicial del name
    en brand-100. NO degradado, NO placeholder generico.
  - Filete brand-400 chiquito como marca editorial.
  - Eyebrow brand-600 + h1 brand-900 + tagline text-secondary
    todo en el mismo bloque (no hay banda separada).
  - Breadcrumbs NO se renderizan adentro — la pagina los monta
    ARRIBA del hero (variant="canvas").

  Alturas por nivel (decreciente, region > province > department >
  locality):
  - region:     60vh desktop, 42vh mobile, h1 text-5xl -> 4xl
  - province:   50vh / 40vh, h1 text-4xl -> 3xl
  - department: 45vh / 38vh, h1 text-3xl -> 2xl
  - locality:   40vh / 36vh, h1 text-3xl -> 2xl
  - cap region/province: max-h 720px para pantallas muy altas.

  Accesibilidad:
  - `name` es el UNICO <h1> de toda la pagina. El eyebrow es <p>
    (no heading), el tagline tambien <p>.
  - Watermark: aria-hidden="true" (decorativo, redundante con h1).
  - Imagen: alt descriptivo (recibido por prop). Si la pagina no
    pasa alt, defaultea a `${name} — vista del lugar`.
  - Contraste: scrim garantiza AA blanco sobre la imagen mas
    clara del set (verificado con foto Uspallata mediodia).

  Animacion:
  - Imagen estatica (sin parallax, sin zoom infinito).
  - Caption + tagline: clase `.vp-rise` (opacity 0->1, translateY
    16->0, duration-base, ease-decelerate). Reduced-motion ya
    cortado a 0.01ms en globals.css.

  Tokens:
  - Eyebrow: font-display text-sm weight 600 uppercase tracking-caps.
  - Title: font-display semibold tracking-tight leading-1.02.
  - Scrim: linear-gradient(to top, oklch 12% .01 84 / .78 -> .05 -> .18).
  - Banda tagline: bg brand-50, border-top brand-100, tagline
    font-display 500 brand-900 max-width 30ch.
  - Watermark: brand-100, font-size 28vw desktop / 48vw mobile,
    inicial del name en font-display.
  - Padding interno: space-6 x space-8, max-width 1120px.
*/

export interface GeoHeroProps {
  level: "region" | "province" | "department" | "locality";
  /**
   * Nombre del lugar — sera el unico <h1> de la pagina.
   */
  name: string;
  /**
   * Etiqueta del nivel localizada (ej. "REGIÓN", "PROVINCIA"). La
   * pagina la pasa traducida desde `messages/{locale}.json`. Va en
   * el eyebrow (no es heading, no entra en jerarquia).
   */
  eyebrow: string;
  /**
   * Bajada editorial (max 120 chars). En variante con foto va en
   * la banda brand-50 debajo del hero. En variante sin foto va
   * dentro del bloque tipografico, debajo del h1.
   */
  tagline?: string | null;
  /**
   * Breadcrumbs propias del nivel. Solo se renderizan ADENTRO del
   * hero cuando hay foto (variant="photo"). Sin foto, la pagina las
   * monta arriba del hero (variant="canvas").
   */
  breadcrumbs: Crumb[];
  /**
   * Aria-label del nav de breadcrumbs (localizado por la pagina).
   * Solo se usa cuando se renderiza dentro del hero (con foto).
   */
  breadcrumbsAriaLabel?: string;
  /**
   * URL Cloudinary de la imagen primary del nivel (hero variant
   * ~1920x1080). Si es undefined/null -> variante tipografica.
   */
  imageUrl?: string | null;
  /**
   * Alt text descriptivo de la imagen. Si no se pasa, default
   * `${name}, vista del lugar`. Importante para AT y SEO de
   * imagenes Cloudinary.
   */
  imageAlt?: string;
  /**
   * Slot para el trigger de galeria (botton "Ver galeria · N").
   * Vive en el hero abajo-derecha solo cuando hay foto. La pagina
   * lo compone con GalleryProvider del PhotoGallery client
   * component — asi GeoHero queda server.
   */
  galleryTrigger?: React.ReactNode;
  className?: string;
}

/**
 * ID estable del <h1> del GeoHero. Lo exportamos para que otros
 * componentes (EditorialContent section) puedan referenciarlo via
 * aria-labelledby — minor A finding del audit. Como el GeoHero se
 * monta exactamente una vez por pagina geo, el id estatico es seguro.
 */
export const GEO_HERO_H1_ID = "geo-hero-name";

const HERO_HEIGHTS: Record<
  GeoHeroProps["level"],
  { desktop: string; mobile: string; maxHeight?: string }
> = {
  region: { desktop: "60vh", mobile: "42vh", maxHeight: "720px" },
  province: { desktop: "50vh", mobile: "40vh", maxHeight: "720px" },
  department: { desktop: "45vh", mobile: "38vh" },
  locality: { desktop: "40vh", mobile: "36vh" },
};

const TITLE_SIZES: Record<
  GeoHeroProps["level"],
  { desktop: string; mobile: string }
> = {
  region: {
    desktop: "var(--text-5xl)",
    mobile: "var(--text-4xl)",
  },
  province: {
    desktop: "var(--text-4xl)",
    mobile: "var(--text-3xl)",
  },
  department: {
    desktop: "var(--text-3xl)",
    mobile: "var(--text-2xl)",
  },
  locality: {
    desktop: "var(--text-3xl)",
    mobile: "var(--text-2xl)",
  },
};

export function GeoHero(props: GeoHeroProps) {
  const hasPhoto = typeof props.imageUrl === "string" && props.imageUrl.length > 0;

  if (hasPhoto) {
    return <GeoHeroWithPhoto {...props} />;
  }
  return <GeoHeroTypographic {...props} />;
}

/* ---------- Variante con foto ---------- */

function GeoHeroWithPhoto({
  level,
  name,
  eyebrow,
  tagline,
  breadcrumbs,
  breadcrumbsAriaLabel,
  imageUrl,
  imageAlt,
  galleryTrigger,
  className,
}: GeoHeroProps) {
  const heights = HERO_HEIGHTS[level];
  const sizes = TITLE_SIZES[level];
  const computedAlt = imageAlt ?? `${name}, vista del lugar`;

  return (
    <>
      <section
        className={cn(
          "relative w-full overflow-hidden",
          // Altura responsive via custom property (single source).
          // CSS arbitrary values con calc no soportan media queries —
          // usamos `[--hero-h-mobile]` + `min-[640px]:[--hero-h]`
          // como override en breakpoint sm.
          "h-[var(--hero-h-mobile)] min-[640px]:h-[var(--hero-h)]",
          heights.maxHeight && "max-h-[720px]",
          className,
        )}
        style={
          {
            "--hero-h": heights.desktop,
            "--hero-h-mobile": heights.mobile,
          } as React.CSSProperties
        }
      >
        {/*
          Imagen full-bleed. priority + fetchPriority="high" para LCP.
          HeroPhotoImage es un wrapper client que, cuando hay
          PhotoGallery provider arriba con > 1 imagenes, hace toda la
          imagen clickeable para abrir el lightbox (M7 fix). Cuando no
          hay galeria, renderea Image simple sin handler.
        */}
        <HeroPhotoImage src={imageUrl!} alt={computedAlt} />

        {/* Scrim degradado. oklch oscuro con stops del handoff. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, oklch(12% 0.01 84 / 0.78) 0%, oklch(12% 0.01 84 / 0.32) 38%, oklch(12% 0.01 84 / 0.05) 64%, oklch(12% 0.01 84 / 0.18) 100%)",
          }}
        />

        {/* Capa de contenido sobre la imagen + scrim. */}
        <div className="relative z-10 flex h-full w-full flex-col">
          {/* Top: breadcrumbs adentro */}
          {/*
            Breadcrumbs adentro del hero (variant photo). Minor B
            del audit: omitir cuando hay solo 1 item (region) — el h1
            del hero ya muestra el nombre, breadcrumb de 1 item es
            redundante y agrega ruido visual sobre la foto.
          */}
          {breadcrumbs.length > 1 && (
            <Breadcrumbs
              items={breadcrumbs}
              variant="photo"
              ariaLabel={breadcrumbsAriaLabel}
            />
          )}

          {/* Spacer */}
          <div className="grow" />

          {/* Bottom: eyebrow + h1 a la izquierda, galleryTrigger a la
              derecha. flex con items-end + justify-between. */}
          <div
            className={cn(
              "mx-auto w-full max-w-[1120px]",
              "px-[var(--space-8)] py-[var(--space-6)]",
              "flex items-end justify-between gap-[var(--space-6)]",
            )}
          >
            <div
              className={cn(
                "text-white vp-rise [text-shadow:0_2px_12px_oklch(0%_0_0_/_0.35)]",
                "min-w-0", // permite truncate inside
              )}
            >
              <p
                className={cn(
                  "font-display font-semibold uppercase",
                  "text-[length:var(--text-sm)]",
                  "[letter-spacing:var(--tracking-caps)]",
                  "text-white/85 mb-[var(--space-3)]",
                )}
              >
                {eyebrow}
              </p>
              <h1
                id={GEO_HERO_H1_ID}
                className={cn(
                  "font-display font-semibold",
                  "[letter-spacing:var(--tracking-tight)]",
                  "leading-[1.02]",
                  "[text-wrap:balance]",
                  // Tamano responsivo via custom property (mobile->desktop)
                  "text-[length:var(--hero-h1-mobile)] min-[640px]:text-[length:var(--hero-h1)]",
                )}
                style={
                  {
                    "--hero-h1": sizes.desktop,
                    "--hero-h1-mobile": sizes.mobile,
                  } as React.CSSProperties
                }
              >
                {name}
              </h1>
            </div>

            {/* Slot trigger galeria. Si esta vacio, el flex sigue
                balanceado por el justify-between con el div izquierdo. */}
            {galleryTrigger && (
              <div className="shrink-0 vp-rise">{galleryTrigger}</div>
            )}
          </div>
        </div>
      </section>

      {/* Banda editorial debajo del hero con el tagline. Solo si hay
          tagline; sino el hero termina sin extension. */}
      {tagline && tagline.trim().length > 0 && (
        <section
          className={cn(
            "w-full bg-[var(--brand-50)] border-t border-[var(--brand-100)]",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-[1120px]",
              "px-[var(--space-8)] py-[var(--space-8)]",
            )}
          >
            <p
              className={cn(
                "font-display font-medium",
                "text-[length:var(--text-xl)]",
                "leading-[var(--leading-snug)]",
                "text-[var(--brand-900)]",
                "max-w-[30ch]",
                "[text-wrap:pretty]",
                "vp-rise",
              )}
            >
              {tagline}
            </p>
          </div>
        </section>
      )}
    </>
  );
}

/* ---------- Variante tipografica (sin foto) ---------- */

function GeoHeroTypographic({
  level,
  name,
  eyebrow,
  tagline,
  className,
}: GeoHeroProps) {
  const heights = HERO_HEIGHTS[level];
  const sizes = TITLE_SIZES[level];
  // Watermark: primera letra del name. Usamos Array.from para que
  // emojis/multi-code-point graphemes no se rompan (aunque names
  // geograficos en AR no los van a tener nunca).
  const watermarkChar = Array.from(name)[0]?.toUpperCase() ?? "";

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden",
        "bg-[var(--brand-50)]",
        "h-[var(--hero-h-mobile)] min-[640px]:h-[var(--hero-h)]",
        heights.maxHeight && "max-h-[720px]",
        className,
      )}
      style={
        {
          "--hero-h": heights.desktop,
          "--hero-h-mobile": heights.mobile,
        } as React.CSSProperties
      }
    >
      {/* Watermark gigante. brand-100 sobre brand-50 — contraste
          intencionalmente bajo para que sea decorativo. aria-hidden
          + user-select-none. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute pointer-events-none select-none",
          "right-[var(--space-6)] top-1/2 -translate-y-1/2",
          "font-display font-semibold leading-none",
          "text-[var(--brand-100)]",
          // 28vw desktop, 48vw mobile per handoff.
          "text-[48vw] min-[640px]:text-[28vw]",
        )}
      >
        {watermarkChar}
      </span>

      {/* Capa de contenido alineada izquierda, centrada verticalmente. */}
      <div
        className={cn(
          "relative z-10 flex h-full w-full items-center",
          "mx-auto max-w-[1120px]",
          "px-[var(--space-8)] py-[var(--space-6)]",
        )}
      >
        <div className="vp-rise max-w-[60ch] min-w-0">
          {/* Filete brand-400 — marca editorial chica que arranca el
              bloque. 40x3px, radius-pill. */}
          <div
            aria-hidden="true"
            className="w-10 h-[3px] rounded-full bg-[var(--brand-400)] mb-[var(--space-5)]"
          />

          <p
            className={cn(
              "font-display font-semibold uppercase",
              "text-[length:var(--text-sm)]",
              "[letter-spacing:var(--tracking-caps)]",
              "text-[var(--brand-600)] mb-[var(--space-3)]",
            )}
          >
            {eyebrow}
          </p>

          <h1
            className={cn(
              "font-display font-semibold",
              "[letter-spacing:var(--tracking-tight)]",
              "leading-[1.02]",
              "text-[var(--brand-900)]",
              "[text-wrap:balance]",
              "text-[length:var(--hero-h1-mobile)] min-[640px]:text-[length:var(--hero-h1)]",
            )}
            style={
              {
                "--hero-h1": sizes.desktop,
                "--hero-h1-mobile": sizes.mobile,
              } as React.CSSProperties
            }
          >
            {name}
          </h1>

          {tagline && tagline.trim().length > 0 && (
            <p
              className={cn(
                "mt-[var(--space-5)]",
                "font-display font-medium",
                "text-[length:var(--text-xl)]",
                "leading-[var(--leading-snug)]",
                "text-[var(--text-secondary)]",
                "[text-wrap:pretty]",
              )}
            >
              {tagline}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
