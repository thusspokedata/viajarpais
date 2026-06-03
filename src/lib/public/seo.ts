import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { markdownToPlainText } from "./sanitizeMarkdown";
import type { GeoNode, SupportedLocale } from "./geoLoader";

/*
  Helpers de SEO para las 4 paginas geograficas publicas.

  Exports:
  - buildGeoMetadata(node, locale): Metadata para generateMetadata().
  - buildGeoJsonLd(node, locale): JSON-LD del schema correspondiente
    al nivel (TouristRegion / AdministrativeArea / Place).
  - buildBreadcrumbJsonLd(node, locale): JSON-LD BreadcrumbList.
  - buildGeoPath(node, locale): path publico canonico.

  Site URL viene de NEXT_PUBLIC_SITE_URL. En CI puede no estar
  seteada — las URLs caen a relativas (Google las acepta pero
  penaliza leve). En produccion siempre debe estar.

  Decisiones cerradas (handoff §"SEO"):
  - title: `{name} — {parent} | ViajarPaís` ajustable por nivel.
  - description: primeros ~155 chars de description (plain text via
    markdownToPlainText) o el tagline si no hay description, o
    fallback i18n si no hay nada.
  - openGraph.images: hero variant 1200x630 (Cloudinary "og"); si
    no hay foto del nodo, fallback /og-default.jpg.
  - alternates.languages: hreflang es/en/pt-BR + x-default → es.
  - Schema por nivel:
    - region     → TouristRegion
    - province   → AdministrativeArea
    - department → AdministrativeArea
    - locality   → Place
  - BreadcrumbList JSON-LD adicional siempre.
  - canonical: URL completa por locale.
*/

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
const SITE_NAME = "ViajarPaís";

/**
 * Path publico canonico de un nodo en un locale. `es` es default
 * sin prefix (per next-intl `localePrefix: "as-needed"`); los demas
 * llevan `/{locale}` antepuesto.
 */
export function buildGeoPath(
  node: GeoNode,
  locale: SupportedLocale,
): string {
  const segments = [
    ...node.parents.map((p) => p.slug),
    node.slug,
  ];
  const path = `/${segments.join("/")}`;
  return locale === "es" ? path : `/${locale}${path}`;
}

/**
 * Mismo concepto pero para un href arbitrario (ej. breadcrumb
 * intermedio sin segments anidados). Recibe el path sin locale.
 */
function localizePath(path: string, locale: SupportedLocale): string {
  return locale === "es" ? path : `/${locale}${path}`;
}

/**
 * URL absoluta. Si SITE_URL no esta seteado, devuelve relativa.
 */
function absoluteUrl(path: string): string {
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

/**
 * Hreflang map con las 3 versiones + x-default → es.
 */
function buildLanguagesAlternates(node: GeoNode) {
  return {
    es: absoluteUrl(buildGeoPath(node, "es")),
    en: absoluteUrl(buildGeoPath(node, "en")),
    "pt-BR": absoluteUrl(buildGeoPath(node, "pt-BR")),
    "x-default": absoluteUrl(buildGeoPath(node, "es")),
  };
}

/**
 * BCP 47 con underscore para OpenGraph (`og:locale`).
 *
 * - es     → es_AR (Argentina, no Espana — el directorio es de AR).
 * - en     → en_US.
 * - pt-BR  → pt_BR.
 */
function localeToOgLocale(locale: SupportedLocale): string {
  if (locale === "es") return "es_AR";
  if (locale === "en") return "en_US";
  return "pt_BR";
}

/* ================================================================
   buildGeoMetadata
   ================================================================ */

export async function buildGeoMetadata(
  node: GeoNode,
  locale: SupportedLocale,
): Promise<Metadata> {
  const t = await getTranslations("Public");

  // Title: "{name} — {parent} | ViajarPaís" cuando hay parent.
  const parent = node.parents[node.parents.length - 1];
  const title = parent
    ? `${node.name} — ${parent.name} | ${SITE_NAME}`
    : `${node.name} | ${SITE_NAME}`;

  // Description: prefer descriptionEs/En/PtBr stripped a 155 chars;
  // sino tagline (max 155); sino fallback i18n.
  let description: string;
  if (node.description) {
    description = markdownToPlainText(node.description, 155);
  } else if (node.tagline) {
    description =
      node.tagline.length <= 155
        ? node.tagline
        : node.tagline.slice(0, 154).trimEnd() + "…";
  } else {
    description = t("fallbackMetaDescription", { name: node.name });
  }

  // OG image — primary del nodo con variant "og" 1200x630 o fallback.
  const ogImageUrl = node.primaryImage
    ? cloudinaryUrl(node.primaryImage.publicId, "og")
    : absoluteUrl("/og-default.jpg");

  const canonical = absoluteUrl(buildGeoPath(node, locale));

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildLanguagesAlternates(node),
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: localeToOgLocale(locale),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: node.primaryImage?.alt ?? node.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

/* ================================================================
   JSON-LD helpers
   ================================================================ */

/**
 * Tipo de schema.org segun nivel del nodo.
 */
const SCHEMA_TYPE_BY_LEVEL: Record<GeoNode["level"], string> = {
  region: "TouristRegion",
  province: "AdministrativeArea",
  department: "AdministrativeArea",
  locality: "Place",
};

/**
 * Genera el JSON-LD principal del nivel. Incluye containedInPlace
 * apuntando al padre inmediato si existe (province dentro de
 * region, department dentro de province, locality dentro de
 * department). Sin geo coords visibles (decision: NO mapas en v0.4).
 */
export function buildGeoJsonLd(
  node: GeoNode,
  locale: SupportedLocale,
): Record<string, unknown> {
  const url = absoluteUrl(buildGeoPath(node, locale));
  const ogImageUrl = node.primaryImage
    ? cloudinaryUrl(node.primaryImage.publicId, "og")
    : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE_BY_LEVEL[node.level],
    name: node.name,
    url,
  };

  if (node.description) {
    jsonLd.description = markdownToPlainText(node.description, 300);
  } else if (node.tagline) {
    jsonLd.description = node.tagline;
  }

  if (ogImageUrl) {
    jsonLd.image = ogImageUrl;
  }

  // containedInPlace — padre inmediato.
  const parent = node.parents[node.parents.length - 1];
  if (parent) {
    jsonLd.containedInPlace = {
      "@type":
        parent.level === "region"
          ? "TouristRegion"
          : "AdministrativeArea",
      name: parent.name,
      url: absoluteUrl(localizePath(parent.href, locale)),
    };
  }

  return jsonLd;
}

/**
 * BreadcrumbList JSON-LD — siempre presente. Schema.org lo
 * recomienda para mejorar el SERP display de Google.
 */
export function buildBreadcrumbJsonLd(
  node: GeoNode,
  locale: SupportedLocale,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: node.breadcrumbs.map((crumb, idx) => {
      const isLast = idx === node.breadcrumbs.length - 1;
      return {
        "@type": "ListItem",
        position: idx + 1,
        name: crumb.label,
        // Ultimo item (current page): sin `item` para que Google no
        // genere autoreferencia.
        ...(isLast
          ? {}
          : { item: absoluteUrl(localizePath(crumb.href, locale)) }),
      };
    }),
  };
}
