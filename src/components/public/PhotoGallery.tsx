"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Close as XIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui";

/*
  <PhotoGallery /> — pattern v0.4-a §4 del handoff.

  Lightbox headless propio sobre Radix Dialog (decision cerrada del
  handoff: NO yet-another-react-lightbox, NO photoswipe).

  Por que Radix Dialog en lugar de lib externa:
  - Focus-trap, scroll-lock, Esc handler y aria-modal vienen
    automaticos sin codigo nuestro.
  - Cero peso de imagen-libs ajenos (~15-50kb evitados).
  - Look 100% custom con tokens del DS — coherencia con el resto.
  - El prototipo Parte 1 ya tenia la logica armada (counter, prev/
    next, thumbs, swipe mobile, teclado).

  Estructura:
    <PhotoGallery images={...}>
      ...children (incluyen el GeoHero con galleryTrigger slot)...
    </PhotoGallery>

  Si images.length <= 1, NO se monta el provider ni el lightbox —
  el wrapper es transparente. Si images.length > 1:
  - Crea GalleryContext con index + open/close/prev/next/goTo.
  - Renderiza children + el GalleryLightbox (portal).
  - El <GalleryTrigger /> (boton "Ver galeria · N") usa
    useGallery().open(0) para disparar el modal.

  La pagina compone:

    <PhotoGallery images={images}>
      <GeoHero
        ...
        galleryTrigger={
          images.length > 1
            ? <GalleryTrigger label={t("Public.viewGallery", {count: images.length})} />
            : undefined
        }
      />
      <main>...</main>
    </PhotoGallery>

  Teclado:
  - Esc → cierra (Radix lo provee).
  - ← / → → navegar.
  - Home / End → primera / ultima.

  Mobile:
  - Swipe horizontal > 40px → cambia foto. Pointer events directo
    (no react-swipeable — son ~10 lineas, evita dep extra).
  - touch-action: pan-y permite scroll vertical pero captura
    swipe horizontal sin pelearle al browser.

  Accesibilidad:
  - Dialog.Content aria-label="Galeria de fotos".
  - Cada thumb: <button aria-label="Foto i+1"> + aria-current cuando
    es el activo.
  - Contador con aria-live="polite" para anunciar el cambio.
  - Imagen principal: alt = caption ?? alt.
  - Radix garantiza focus-trap y devuelve el foco al trigger al
    cerrar.

  Animaciones:
  - Backdrop: vp-fade-in duration-base ease-decelerate.
  - Shell: vp-scale-in duration-base ease-emphasized.
  - Buttons activos: active:scale-95 duration-fast.
  - Reduced motion: globals.css ya corta animaciones a 0.01ms.
*/

export interface GalleryImage {
  /** URL Cloudinary, variant grande (~1600w). */
  url: string;
  /** URL Cloudinary thumbnail (~200w). */
  thumbUrl: string;
  /** Cloudinary publicId — sirve como key estable en listas. */
  publicId: string;
  /** Caption editorial. Opcional. Si existe, prioriza sobre alt para alt del img. */
  caption?: string;
  /** Alt text descriptivo (siempre presente, fallback de caption). */
  alt: string;
}

export interface PhotoGalleryProps {
  images: GalleryImage[];
  /** Index inicial al abrir el lightbox. Default 0 (primary). */
  initialIndex?: number;
  /**
   * Aria-label del Dialog. Default "Galería de fotos". Pasalo
   * localizado desde la pagina via t("Public.galleryAriaLabel").
   */
  ariaLabel?: string;
  /**
   * Labels localizados para teclas. Default ES. La pagina pasa la
   * version localizada via i18n.
   */
  labels?: {
    closeLabel?: string;     // "Cerrar galería"
    prevLabel?: string;      // "Foto anterior"
    nextLabel?: string;      // "Foto siguiente"
    thumbLabelPrefix?: string; // "Foto" — formato: "{prefix} {n}"
  };
  /** Children. Pueden incluir GeoHero + secciones del layout. */
  children?: React.ReactNode;
}

interface GalleryContextValue {
  images: GalleryImage[];
  index: number;
  isOpen: boolean;
  open: (i?: number) => void;
  close: () => void;
  prev: () => void;
  next: () => void;
  goTo: (i: number) => void;
}

const GalleryContext = React.createContext<GalleryContextValue | null>(null);

/**
 * Hook consumidor para que componentes hijos (ej. GalleryTrigger)
 * disparen el lightbox. Tira error si se usa fuera del provider.
 */
export function useGallery(): GalleryContextValue {
  const ctx = React.useContext(GalleryContext);
  if (!ctx) {
    throw new Error("useGallery() must be used inside <PhotoGallery>");
  }
  return ctx;
}

/**
 * Variante no-throwing del hook — devuelve null si no hay provider.
 * Util para componentes que opcionalmente abren la galeria pero
 * que tambien deben renderear cuando el padre no es PhotoGallery
 * (ej. HeroPhotoImage en una pagina sin >1 fotos).
 */
export function useGalleryOptional(): GalleryContextValue | null {
  return React.useContext(GalleryContext);
}

export function PhotoGallery({
  images,
  initialIndex = 0,
  ariaLabel = "Galería de fotos",
  labels,
  children,
}: PhotoGalleryProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  // Clamp del index a [0, length-1]. Si `initialIndex` (o un `open(i)`
  // mas abajo) viene fuera de rango, `images[index]` seria undefined y
  // el render del lightbox crashea al leer `current.publicId`.
  const clampIndex = React.useCallback(
    (i: number) => Math.min(Math.max(i, 0), images.length - 1),
    [images.length],
  );
  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );

  const open = React.useCallback(
    (i: number = 0) => {
      setIndex(clampIndex(i));
      setIsOpen(true);
    },
    [clampIndex],
  );

  const close = React.useCallback(() => setIsOpen(false), []);

  const next = React.useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = React.useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goTo = React.useCallback(
    (i: number) => {
      if (i < 0 || i >= images.length) return;
      setIndex(i);
    },
    [images.length],
  );

  // Sin > 1 imagenes no monta provider ni lightbox — el wrapper es
  // transparente. La pagina sabra no incluir el GalleryTrigger en
  // el hero.
  if (images.length <= 1) {
    return <>{children}</>;
  }

  const ctxValue: GalleryContextValue = {
    images,
    index,
    isOpen,
    open,
    close,
    prev,
    next,
    goTo,
  };

  return (
    <GalleryContext.Provider value={ctxValue}>
      {children}
      <GalleryLightbox ariaLabel={ariaLabel} labels={labels} />
    </GalleryContext.Provider>
  );
}

/* ---------- GalleryTrigger ---------- */

export interface GalleryTriggerProps {
  /**
   * Label completo del boton, ya localizado. Default `Ver galería · ${n}`.
   * La pagina pasa la version localizada via i18n.
   */
  label?: string;
  className?: string;
}

/**
 * Boton "Ver galería · N" para montarse en el slot galleryTrigger
 * del GeoHero (variante con foto). Usa useGallery() asi el click
 * dispara el lightbox del provider.
 */
export function GalleryTrigger({ label, className }: GalleryTriggerProps) {
  const { open, images } = useGallery();
  const text = label ?? `Ver galería · ${images.length}`;

  return (
    <button
      type="button"
      onClick={() => open(0)}
      aria-haspopup="dialog"
      className={cn(
        // Glassmorph: bg semitransparente + backdrop-blur + borde sutil.
        "inline-flex items-center gap-[var(--space-2)]",
        "px-[var(--space-5)] py-[var(--space-3)]",
        "min-h-[44px]",
        "rounded-[var(--radius-md)]",
        "text-[length:var(--text-sm)] font-medium",
        "text-white",
        "bg-[oklch(100%_0_0_/_0.16)]",
        "backdrop-blur-[8px]",
        "border border-[oklch(100%_0_0_/_0.28)]",
        "transition-colors duration-[var(--duration-fast)]",
        "hover:bg-[oklch(100%_0_0_/_0.24)]",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-white focus-visible:ring-offset-2",
        "focus-visible:ring-offset-transparent",
        className,
      )}
    >
      {text}
    </button>
  );
}

/* ---------- GalleryLightbox (internal) ---------- */

function GalleryLightbox({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels?: PhotoGalleryProps["labels"];
}) {
  const { images, index, isOpen, close, prev, next, goTo } = useGallery();
  // Defensa adicional: si por algun motivo `index` quedo fuera de rango
  // (ej. `images` cambia de tamano mientras el lightbox esta abierto),
  // caemos a la primera imagen en vez de crashear con undefined.
  const current = images[index] ?? images[0];

  const closeLabel = labels?.closeLabel ?? "Cerrar galería";
  const prevLabel = labels?.prevLabel ?? "Foto anterior";
  const nextLabel = labels?.nextLabel ?? "Foto siguiente";
  const thumbPrefix = labels?.thumbLabelPrefix ?? "Foto";

  // Teclado: ←/→ navegan, Home/End ir a primera/ultima.
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(images.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, prev, next, goTo, images.length]);

  // Auto-scroll del thumb activo a la vista cuando cambia el index.
  const thumbsRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    const container = thumbsRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      `[data-thumb-index="${index}"]`,
    );
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index, isOpen]);

  /*
    Browser back-button cierra el lightbox (no navega afuera).

    Handoff §"Casos edge": "Lightbox abierto + back del browser →
    Cerrar lightbox en popstate, no navegar fuera". Especialmente en
    mobile (Android Chrome/iOS Safari) el gesto back es la forma
    estandar de cerrar modals.

    Pattern:
    1. Al abrir, pushState({lightbox: true}) — empuja una entrada de
       history nuestra. Marker en `state.lightbox` para distinguirla.
    2. Listener popstate: cuando el browser fire popstate (el usuario
       hizo back), la siguiente state es la previa SIN nuestro
       marker. Cerramos el lightbox.
    3. Cleanup: cuando el lightbox cierra por Esc/X (no por popstate),
       hacemos history.back() para popear nuestro marker — sino la
       URL del usuario queda contaminada con una entrada extra.
       Distinguimos los dos paths chequeando state.lightbox: si es
       true, la cleanup viene de un close manual y debemos popear;
       si es false, el browser ya nos sacó del state via popstate y
       no debemos popear de nuevo (que iria un paso atras del que
       el usuario queria).
  */
  React.useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    window.history.pushState({ lightbox: true }, "");
    const handler = () => close();
    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      if (window.history.state?.lightbox === true) {
        window.history.back();
      }
    };
  }, [isOpen, close]);

  // Swipe mobile: pointer events directos. delta > 40 = cambio.
  const swipeRef = React.useRef<{ startX: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeRef.current = { startX: e.clientX };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const delta = e.clientX - start.startX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) prev();
      else next();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[var(--surface-overlay)]",
            "backdrop-blur-[6px]",
            "data-[state=open]:animate-[vp-fade-in_var(--duration-base)_var(--ease-decelerate)]",
          )}
        />
        <Dialog.Content
          aria-label={ariaLabel}
          className={cn(
            "fixed inset-0 z-50",
            "flex flex-col",
            "focus:outline-none",
            "data-[state=open]:animate-[vp-scale-in_var(--duration-base)_var(--ease-emphasized)]",
          )}
        >
          {/*
            Radix Dialog requiere un Dialog.Title para a11y (screen
            readers anuncian el modal con el title). El visual ya
            tiene un aria-label en Content + counter top-left, asi
            que el title puro es redundante visualmente — lo ponemos
            sr-only. Mismo texto que el ariaLabel para coherencia.
          */}
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>

          {/* Top bar — counter + close */}
          <div
            className={cn(
              "flex items-center justify-between",
              "px-[var(--space-5)] py-[var(--space-4)]",
            )}
          >
            <span
              aria-live="polite"
              className={cn(
                "font-mono text-white/85",
                "text-[length:var(--text-sm)]",
              )}
            >
              {index + 1} / {images.length}
            </span>
            <Dialog.Close
              aria-label={closeLabel}
              className={cn(
                "inline-flex items-center justify-center",
                "h-10 w-10 rounded-full",
                "bg-[oklch(100%_0_0_/_0.10)] border border-[oklch(100%_0_0_/_0.20)]",
                "text-white",
                "transition-colors duration-[var(--duration-fast)]",
                "hover:bg-[oklch(100%_0_0_/_0.22)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              )}
            >
              <XIcon className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Stage — prev | img | next, con swipe handlers */}
          <div
            className="relative flex-1 flex items-center justify-center px-[var(--space-5)]"
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <button
              type="button"
              onClick={prev}
              aria-label={prevLabel}
              className={cn(
                "absolute left-[var(--space-5)] top-1/2 -translate-y-1/2 z-10",
                "h-11 w-11 inline-flex items-center justify-center rounded-full",
                "bg-[oklch(100%_0_0_/_0.12)] backdrop-blur-sm",
                "border border-[oklch(100%_0_0_/_0.18)]",
                "text-white",
                "transition-all duration-[var(--duration-fast)]",
                "hover:bg-[oklch(100%_0_0_/_0.22)]",
                "active:scale-[0.94]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              )}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>

            {/*
              Usamos <img> en lugar de next/image en el lightbox por dos
              razones:
              1. Layout flexible: el img debe contener-se en el viewport
                 sin alterar el flex-1 del stage. next/image fill requiere
                 un parent con dimensiones explicitas, que pelea con el
                 flex centrado.
              2. Carga ya proviene de Cloudinary con la variant grande
                 (~1600w) — no necesitamos optimizacion adicional de Next.
              El warning eslint del rule no-img-element NO aplica al
              lightbox; el rule es para imagenes en flujo de pagina
              normal donde la opt si importa para CLS/LCP.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.publicId}
              src={current.url}
              alt={current.caption ?? current.alt}
              className={cn(
                "max-w-full max-h-full object-contain",
                "shadow-[var(--shadow-elevated)]",
                "select-none pointer-events-none",
              )}
              draggable={false}
            />

            <button
              type="button"
              onClick={next}
              aria-label={nextLabel}
              className={cn(
                "absolute right-[var(--space-5)] top-1/2 -translate-y-1/2 z-10",
                "h-11 w-11 inline-flex items-center justify-center rounded-full",
                "bg-[oklch(100%_0_0_/_0.12)] backdrop-blur-sm",
                "border border-[oklch(100%_0_0_/_0.18)]",
                "text-white",
                "transition-all duration-[var(--duration-fast)]",
                "hover:bg-[oklch(100%_0_0_/_0.22)]",
                "active:scale-[0.94]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              )}
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Caption — debajo de la imagen, fuera del frame */}
          {current.caption && (
            <p
              className={cn(
                "text-center px-[var(--space-5)] pt-[var(--space-2)]",
                "text-[length:var(--text-sm)]",
                "text-[oklch(100%_0_0_/_0.78)]",
              )}
            >
              {current.caption}
            </p>
          )}

          {/* Thumbs strip */}
          <div
            ref={thumbsRef}
            className={cn(
              "overflow-x-auto",
              "px-[var(--space-5)] py-[var(--space-4)]",
            )}
          >
            <div className="flex gap-[var(--space-2)] justify-center min-w-min mx-auto">
              {images.map((img, i) => (
                <button
                  key={img.publicId}
                  type="button"
                  data-thumb-index={i}
                  onClick={() => goTo(i)}
                  aria-label={`${thumbPrefix} ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "shrink-0",
                    // 64x44 per handoff.
                    "h-11 w-16 rounded-[var(--radius-xs)] overflow-hidden",
                    "transition-opacity duration-[var(--duration-fast)]",
                    i === index
                      ? "opacity-100 ring-1 ring-white"
                      : "opacity-50 hover:opacity-80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
