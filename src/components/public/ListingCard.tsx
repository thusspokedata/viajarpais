"use client";

import * as React from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  Badge,
  FeaturedBadge,
  VerifiedBadge,
  Button,
  cn,
} from "@/components/ui";

/**
 * ListingCard — la ficha de directorio.
 *
 * El tier se distingue por COMPOSICIÓN, no por color saturado:
 * - free      → 1 imagen, 2 líneas descripción, sin galería extra.
 * - paid      → 1 imagen + strip lateral cream + mini-galería de 3 thumbs.
 * - featured  → imagen full-bleed más alta, badge "Selección" tipográfico,
 *               más aire vertical, sin "DESTACADO" gritón.
 *
 * El badge Verificado se posiciona top-right sobre la imagen, anclado
 * a la marca. El estado vencido se monocromatiza (handled en VerifiedBadge).
 */

export type ListingTier = "free" | "paid" | "featured";

export interface ListingCardProps {
  tier: ListingTier;
  name: string;
  category: string;
  province: string;
  locality: string;
  description: string;
  imageUrl?: string;
  galleryUrls?: string[];
  verifiedAt?: string;
  expiresAt?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ListingCard({
  tier,
  name,
  category,
  province,
  locality,
  description,
  imageUrl,
  galleryUrls,
  verifiedAt,
  expiresAt,
  href = "#",
  className,
}: ListingCardProps) {
  const isFeatured = tier === "featured";
  const isPaid = tier === "paid";

  return (
    <Card
      variant={`tier-${tier}` as `tier-${ListingTier}`}
      className={cn(
        "group/card overflow-hidden flex flex-col",
        isFeatured && "md:row-span-2",
        className
      )}
    >
      {/* Imagen principal */}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-[var(--surface-sunken)]",
          isFeatured ? "aspect-[16/10]" : "aspect-[16/9]"
        )}
      >
        <ImagePlaceholder src={imageUrl} alt={name} />

        {/* Badge tier (esquina superior izquierda) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {tier === "free" ? (
            <Badge variant="tier-free" size="sm">
              Listado
            </Badge>
          ) : null}
          {tier === "paid" ? (
            <Badge variant="tier-paid" size="sm">
              Miembro
            </Badge>
          ) : null}
          {tier === "featured" ? <FeaturedBadge /> : null}
        </div>

        {/* Badge verificado (esquina superior derecha) */}
        {verifiedAt && expiresAt ? (
          <div className="absolute top-3 right-3">
            <VerifiedBadge
              verifiedAt={verifiedAt}
              expiresAt={expiresAt}
              size="sm"
            />
          </div>
        ) : null}
      </div>

      {/* Cuerpo */}
      <CardContent
        className={cn(
          "flex-1 flex flex-col",
          isFeatured ? "p-6 gap-3" : "p-5 gap-2",
          isPaid && "pl-6"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] mb-1">
              {category}
            </div>
            <h3
              className={cn(
                "font-display font-semibold text-[var(--text-primary)] tracking-[var(--tracking-tight)] leading-[var(--leading-tight)]",
                isFeatured ? "text-[var(--text-2xl)]" : "text-[var(--text-lg)]"
              )}
            >
              {name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--text-secondary)]">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {locality}, {province}
          </span>
        </div>

        <p
          className={cn(
            "text-[var(--text-secondary)] leading-[var(--leading-normal)]",
            isFeatured ? "text-[var(--text-base)]" : "text-[var(--text-sm)]",
            "[display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden",
            isFeatured ? "[-webkit-line-clamp:3]" : "[-webkit-line-clamp:2]"
          )}
        >
          {description}
        </p>

        {/* Mini-galería: solo paid + featured */}
        {(isPaid || isFeatured) && galleryUrls && galleryUrls.length > 0 ? (
          <div className="flex gap-1.5 mt-1">
            {galleryUrls.slice(0, 3).map((url, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface-sunken)]",
                  isFeatured ? "h-14 w-20" : "h-10 w-14"
                )}
              >
                <ImagePlaceholder src={url} alt="" subtle />
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className={cn(isFeatured ? "p-6 pt-0" : "p-5 pt-0", "justify-between")}>
        <a
          href={href}
          className={cn(
            "inline-flex items-center gap-1 text-[var(--text-sm)] font-medium",
            "text-[var(--text-link)] hover:text-[var(--text-link-hover)]",
            "transition-colors duration-[var(--duration-fast)]"
          )}
        >
          Ver ficha
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-[var(--duration-base)] group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5" />
        </a>
        {isFeatured ? (
          <Button size="sm" variant="secondary">
            Reservar
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function ImagePlaceholder({
  src,
  alt,
  subtle = false,
}: {
  src?: string;
  alt: string;
  subtle?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[var(--duration-slower)] ease-[var(--ease-standard)] group-hover/card:scale-[1.03]"
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 flex items-center justify-center",
        "bg-[repeating-linear-gradient(135deg,var(--neutral-100)_0,var(--neutral-100)_8px,var(--neutral-150)_8px,var(--neutral-150)_16px)]"
      )}
    >
      {!subtle ? (
        <span className="font-mono text-[10px] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] bg-[var(--surface-base)]/80 px-2 py-1 rounded">
          imagen del lugar
        </span>
      ) : null}
    </div>
  );
}
