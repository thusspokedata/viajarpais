import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getProvinceNode,
  listPopulatedProvinces,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { buildGeoMetadata } from "@/lib/public/seo";
import { routing } from "@/i18n/routing";

/*
  Pagina publica de Province — `/[locale]/{region}/{province-slug}`.

  Resolucion: Province.slug es @unique global, pero el routing
  enforza la cadena region->province para evitar URLs ambiguas y
  mantener jerarquia visible. El loader valida que la province
  pertenezca a la region indicada (findFirst con join condicional).

  ISR: revalidate 24h + tag province:{slug}.
*/

export const dynamicParams = true;
export const revalidate = 86400;

type PageParams = {
  locale: string;
  region: string;
  province: string;
};

type Props = {
  params: Promise<PageParams>;
};

export async function generateStaticParams() {
  const provinces = await listPopulatedProvinces();
  return provinces.flatMap((p) =>
    routing.locales.map((locale) => ({
      locale,
      region: p.region,
      province: p.province,
    })),
  );
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, region, province } = await params;
  if (!isSupportedLocale(locale)) return {};
  setRequestLocale(locale);
  const node = await getProvinceNode(region, province, locale);
  if (!node) return {};
  return buildGeoMetadata(node, locale);
}

export default async function ProvincePage({ params }: Props) {
  const { locale, region, province } = await params;
  setRequestLocale(locale);
  if (!isSupportedLocale(locale)) notFound();

  const node = await getProvinceNode(region, province, locale);
  if (!node) notFound();

  const i18n = await buildGeoPageI18n(node);

  return <GeoPageLayout node={node} locale={locale} i18n={i18n} />;
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale === "es" || locale === "en" || locale === "pt-BR";
}
