import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getRegionNode,
  listPopulatedRegions,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { buildGeoMetadata } from "@/lib/public/seo";
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

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isSupportedLocale(locale)) return {};
  setRequestLocale(locale);
  const node = await getRegionNode(region, locale);
  if (!node) return {};
  return buildGeoMetadata(node, locale);
}

export default async function RegionPage({ params }: Props) {
  const { locale, region } = await params;

  // Validar el locale ANTES de setRequestLocale — sino seteamos el
  // request state con un valor invalido. notFound activa el 404.
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const node = await getRegionNode(region, locale);
  if (!node) notFound();

  const i18n = await buildGeoPageI18n(node);

  return <GeoPageLayout node={node} locale={locale} i18n={i18n} />;
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  // Deriva del routing config — no hardcodear el allowlist (drift con
  // generateStaticParams que tambien usa routing.locales).
  return (routing.locales as readonly string[]).includes(locale);
}
