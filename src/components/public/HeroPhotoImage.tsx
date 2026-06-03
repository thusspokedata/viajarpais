"use client";

import * as React from "react";
import Image from "next/image";
import { useGalleryOptional } from "./PhotoGallery";
import { cn } from "@/components/ui";

/*
  <HeroPhotoImage /> — wrapper client de la imagen primary del
  GeoHero (variante con foto) que, cuando hay galeria (>1 imagen
  en el set), convierte la imagen en un disparador del lightbox.

  M7 fix: el handoff §4 dice explicitamente "Toda la imagen del
  hero también es clickeable (`role='button'` + `aria-haspopup
  ='dialog'`)". GalleryTrigger del corner abajo-derecha cubria solo
  esa interaction surface; el resto del hero (gran area visual)
  no abria nada. Especialmente en mobile, los usuarios esperan
  tap-on-image para abrir galeria.

  Estrategia:
  - useGalleryOptional() — el hook no-throwing devuelve null si
    no hay PhotoGalleryProvider arriba (caso de niveles con
    images.length <= 1, donde el PhotoGallery wrapper es
    transparente). Cuando es null, render como <Image> simple
    sin handler.
  - Cuando hay galeria + provider, envuelve el Image en un <button>
    transparente que ocupa todo el area + dispara
    useGallery().open(0). aria-haspopup="dialog" anuncia el
    comportamiento a AT.
*/

export interface HeroPhotoImageProps {
  src: string;
  alt: string;
  /**
   * Aria-label localizado para el caso clickeable (ej. "Abrir
   * galeria de fotos"). Cuando la pagina no pasa esto, default ES.
   */
  openGalleryLabel?: string;
  className?: string;
}

const HERO_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1120px) 100vw, 1120px";

export function HeroPhotoImage({
  src,
  alt,
  openGalleryLabel = "Abrir galería de fotos",
  className,
}: HeroPhotoImageProps) {
  const gallery = useGalleryOptional();
  // Solo es clickeable si hay context de galeria activo (provider
  // montado con > 1 imagenes). Sino, render simple.
  const clickable = gallery !== null;

  const imageElement = (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes={HERO_SIZES}
      className={cn("object-cover", className)}
    />
  );

  if (!clickable) {
    return imageElement;
  }

  return (
    <button
      type="button"
      onClick={() => gallery!.open(0)}
      aria-haspopup="dialog"
      aria-label={openGalleryLabel}
      className={cn(
        "absolute inset-0 block w-full h-full",
        // El cursor zoom-in sugiere visualmente que se puede abrir
        // el lightbox al hacer click. Override de cursor default
        // de <button>.
        "cursor-zoom-in",
        // Sin estilos de boton — el wrapper solo captura el click.
        // El focus ring va sobre el wrapper porque el Image no es
        // focusable.
        "focus-visible:outline-none focus-visible:ring-4",
        "focus-visible:ring-white/60 focus-visible:ring-offset-0",
      )}
    >
      {imageElement}
    </button>
  );
}
