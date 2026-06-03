import * as React from "react";
import { ListingsLayout } from "./ListingsLayout";
import { GeoHero } from "./GeoHero";
import { Breadcrumbs } from "./Breadcrumbs";
import { EditorialContent } from "./EditorialContent";
import { TranslationDisclaimer } from "./TranslationDisclaimer";
import { PublicEmptyState } from "./PublicEmptyState";
import { PlaceCard, PlaceSection } from "./PlaceCard";
import { PhotoGallery, GalleryTrigger } from "./PhotoGallery";
import { JsonLd } from "./JsonLd";
import {
  buildGeoJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/public/seo";
import type { GeoNode, SupportedLocale } from "@/lib/public/geoLoader";

/*
  <GeoPageLayout /> — composicion estandar de las 4 paginas
  geograficas publicas (region/province/department/locality).

  Recibe un GeoNode + locale + i18n strings ya resueltas por la
  pagina caller, y arma el layout completo segun el handoff §
  "Layout de pagina (generico, 4 niveles)".

  Toda la i18n se resuelve afuera (en la pagina) y se inyecta como
  strings. Esto permite que el layout sea Server Component puro y
  testeable, sin acoplarse a next-intl.

  Estructura:

    <PhotoGallery images={node.images}>      ← provider de lightbox
      {!hasPhoto && <Breadcrumbs canvas />}   ← arriba del hero solo sin foto
      <GeoHero ...>
        {hasGallery && galleryTrigger}        ← slot dentro del hero
      </GeoHero>
      <main>
        Editorial OR EmptyState OR null
        PlaceSection (children) if any
        ListingsLayout (fichas dentro) if any
      </main>
    </PhotoGallery>

  Decisiones de visibilidad:
  - Breadcrumbs canvas: solo si NO hay primaryImage (sino van
    adentro del hero con variant="photo").
  - EditorialContent: si hasEditorial (tagline OR description OR
    images > 0). Si solo hay galeria y nada de texto, igual se
    renderiza la galeria pero sin texto.
  - PublicEmptyState: si !hasEditorial && children.length === 0
    && listings.length === 0. Caso de nivel "vacio" total.
  - TranslationDisclaimer: dentro del EditorialContent, controlado
    por locale + descriptionSource OR taglineSource === MACHINE.
    El componente decide internamente si renderiza.
  - PlaceSection: solo si node.children.length > 0.
  - ListingsLayout: siempre si node.listings.length > 0. Su propio
    empty state lo maneja internamente.

  Server Component — todos los hijos son server salvo PhotoGallery
  (provider) y TranslationDisclaimer (tooltip).
*/

export interface GeoPageLayoutI18n {
  /** Eyebrow localizado por nivel ("REGIÓN" / "PROVINCIA" / etc). */
  eyebrow: string;
  /** Aria-label de breadcrumbs ("Migas de pan" / "Breadcrumbs"). */
  breadcrumbsAriaLabel: string;
  /** Aria-label del lightbox ("Galería de fotos"). */
  galleryAriaLabel: string;
  /** Trigger button label ya interpolado ("Ver galería · 12"). */
  galleryTriggerLabel: string;
  /** Lightbox keyboard/aria labels. */
  galleryLabels: {
    closeLabel: string;
    prevLabel: string;
    nextLabel: string;
    thumbLabelPrefix: string;
  };
  /** Titulo de seccion de sub-niveles ("Provincias adentro" / etc).
   *  null si el nivel no tiene sub-niveles (locality). */
  childrenSectionTitle: string | null;
  /** Empty state strings. */
  emptyState: {
    title: string;
    description: string;
    backToLabel?: string;
    exploreLabel?: string;
  };
  /** Funcion que mapea PlaceChild a meta-string localizado.
   *  Recibe el child con counts ya armados desde el loader. */
  formatChildMeta: (args: {
    listingCount: number;
    subdivisionCount: number | null;
    level: GeoNode["level"];
  }) => string;
  /** Localized "sin foto aún" para PlaceCard sin imagen. */
  noPhotoLabel: string;
}

export interface GeoPageLayoutProps {
  node: GeoNode;
  locale: SupportedLocale;
  i18n: GeoPageLayoutI18n;
  className?: string;
}

export function GeoPageLayout({
  node,
  locale,
  i18n,
}: GeoPageLayoutProps) {
  const hasPhoto = node.primaryImage !== null;
  const hasGallery = node.images.length > 1;
  const isFullyEmpty =
    !node.hasEditorial &&
    node.children.length === 0 &&
    node.listings.length === 0;

  // Parent inmediato para empty state — el ultimo elemento de
  // parents[] (el mas cercano).
  const parent = node.parents[node.parents.length - 1];
  // Grandparent para empty state — el segundo desde el final.
  const grandparent =
    node.parents.length >= 2
      ? node.parents[node.parents.length - 2]
      : undefined;

  // JSON-LD estructurado: schema del nivel + BreadcrumbList. Se
  // emite como array de scripts. La sanitization de `</script>`
  // injection vive en <JsonLd /> (escape <).
  const jsonLd = [
    buildGeoJsonLd(node, locale),
    buildBreadcrumbJsonLd(node, locale),
  ];

  return (
    <PhotoGallery
      images={node.images}
      ariaLabel={i18n.galleryAriaLabel}
      labels={i18n.galleryLabels}
    >
      <JsonLd data={jsonLd} />
      {!hasPhoto && (
        <Breadcrumbs
          items={node.breadcrumbs}
          variant="canvas"
          ariaLabel={i18n.breadcrumbsAriaLabel}
        />
      )}

      <GeoHero
        level={node.level}
        name={node.name}
        eyebrow={i18n.eyebrow}
        tagline={node.tagline}
        breadcrumbs={node.breadcrumbs}
        breadcrumbsAriaLabel={i18n.breadcrumbsAriaLabel}
        imageUrl={node.primaryImage?.url}
        imageAlt={node.primaryImage?.alt}
        galleryTrigger={
          hasPhoto && hasGallery ? (
            <GalleryTrigger label={i18n.galleryTriggerLabel} />
          ) : undefined
        }
      />

      {/*
        Wrapper de contenido — antes era <main> pero (public)/layout.tsx
        ya envuelve {children} con su propio <main>. Tener dos main
        anidados rompe la HTML spec (un solo main landmark por
        documento) y confunde screen readers. Usamos <div> aca y
        dejamos que el layout maneje el landmark.
      */}
      <div>
        {isFullyEmpty ? (
          <div className="mx-auto w-full max-w-[1120px] px-[var(--space-8)] py-[var(--space-10)]">
            <PublicEmptyState
              title={i18n.emptyState.title}
              description={i18n.emptyState.description}
              parent={
                parent && i18n.emptyState.backToLabel
                  ? {
                      name: parent.name,
                      href: parent.href,
                      label: i18n.emptyState.backToLabel,
                    }
                  : undefined
              }
              grandparent={
                grandparent && i18n.emptyState.exploreLabel
                  ? {
                      name: grandparent.name,
                      href: grandparent.href,
                      label: i18n.emptyState.exploreLabel,
                    }
                  : undefined
              }
            />
          </div>
        ) : node.hasEditorial ? (
          <EditorialContent
            tagline={node.tagline}
            markdown={node.description}
          >
            <TranslationDisclaimer
              locale={locale}
              descriptionSource={node.descriptionSource}
              taglineSource={node.taglineSource}
            />
          </EditorialContent>
        ) : null}

        {node.children.length > 0 && i18n.childrenSectionTitle && (
          <PlaceSection title={i18n.childrenSectionTitle}>
            {node.children.map((child) => (
              <PlaceCard
                key={child.href}
                name={child.name}
                href={child.href}
                imageUrl={child.imageUrl}
                imageAlt={child.imageAlt}
                listingCount={child.listingCount}
                noPhotoLabel={i18n.noPhotoLabel}
                metaText={i18n.formatChildMeta({
                  listingCount: child.listingCount,
                  subdivisionCount: child.subdivisionCount,
                  level: node.level,
                })}
              />
            ))}
          </PlaceSection>
        )}

        {node.listings.length > 0 && (
          <ListingsLayout
            listings={node.listings}
            total={node.totalListings}
          />
        )}
      </div>
    </PhotoGallery>
  );
}
