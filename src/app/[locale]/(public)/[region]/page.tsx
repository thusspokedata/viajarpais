import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getRegionNode,
  listPopulatedRegions,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { routing } from "@/i18n/routing";

/*
  Pagina publica de Region — `/[locale]/{region-code}`.

  ISR: revalidate 24h + revalidateTag('region:{code}') dispara
  invalidacion on-demand cuando el admin edita contenido o sube
  imagenes (cableado en commit 17 — buildAllPaths).

  generateStaticParams: solo regiones con descriptionEs cargada.
  Para el resto, dynamicParams=true permite generacion on-demand
  con ISR — la primera visita genera + cachea.

  Estado actual del proyecto (estimado): 0-6 regiones populadas.
  Los visitantes que entren a una region sin contenido editorial
  ven el PublicEmptyState.
*/

export const dynamicParams = true;
export const revalidate = 86400;

type PageParams = {
  locale: string;
  region: string;
};

type Props = {
  params: Promise<PageParams>;
};

/**
 * Pre-render solo regions con contenido editorial cargado, X 3
 * locales. El resto va por ISR on-demand.
 */
export async function generateStaticParams() {
  const regions = await listPopulatedRegions();
  return regions.flatMap((r) =>
    routing.locales.map((locale) => ({
      locale,
      region: r.region,
    })),
  );
}

export default async function RegionPage({ params }: Props) {
  const { locale, region } = await params;
  setRequestLocale(locale);

  // Locale validation — fallback si llega algo fuera del set
  // soportado. notFound activa el 404 publico.
  if (!isSupportedLocale(locale)) notFound();

  const node = await getRegionNode(region, locale);
  if (!node) notFound();

  const i18n = await buildGeoPageI18n(node);

  return <GeoPageLayout node={node} locale={locale} i18n={i18n} />;
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale === "es" || locale === "en" || locale === "pt-BR";
}
