import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getLocalityNode,
  listPopulatedLocalities,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { buildGeoMetadata } from "@/lib/public/seo";
import { routing } from "@/i18n/routing";

/*
  Pagina publica de Locality.
  URL: `/[locale]/{region}/{province-slug}/{department-slug}/{locality-slug}`.

  Locality.slug es @@unique([provinceId, slug]) — unico dentro de
  la provincia (NO de department). Aun asi, el loader valida la
  cadena department->province->region completa para coherencia con
  el URL y evitar que un locality aparezca en URLs de departments
  ajenos.

  Locality es el nivel mas profundo: no tiene sub-niveles ni
  PlaceCard grid. Solo galeria + editorial + ListingsLayout.
  (Las fichas individuales — v0.4-b — aniden bajo /{locality}/{slug}
  cuando exista la pagina detail.)

  ISR: revalidate 24h + tag locality:{slug}.
*/

export const dynamicParams = true;
export const revalidate = 86400;

type PageParams = {
  locale: string;
  region: string;
  province: string;
  department: string;
  locality: string;
};

type Props = {
  params: Promise<PageParams>;
};

export async function generateStaticParams() {
  const localities = await listPopulatedLocalities();
  return localities.flatMap((l) =>
    routing.locales.map((locale) => ({
      locale,
      region: l.region,
      province: l.province,
      department: l.department,
      locality: l.locality,
    })),
  );
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, region, province, department, locality } = await params;
  if (!isSupportedLocale(locale)) return {};
  setRequestLocale(locale);
  const node = await getLocalityNode(
    region,
    province,
    department,
    locality,
    locale,
  );
  if (!node) return {};
  return buildGeoMetadata(node, locale);
}

export default async function LocalityPage({ params }: Props) {
  const { locale, region, province, department, locality } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const node = await getLocalityNode(
    region,
    province,
    department,
    locality,
    locale,
  );
  if (!node) notFound();

  const i18n = await buildGeoPageI18n(node);

  return <GeoPageLayout node={node} locale={locale} i18n={i18n} />;
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (routing.locales as readonly string[]).includes(locale);
}
