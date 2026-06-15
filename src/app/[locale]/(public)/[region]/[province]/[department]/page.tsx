import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getDepartmentNode,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { buildGeoMetadata } from "@/lib/public/seo";
import { routing } from "@/i18n/routing";

/*
  Pagina publica de Department.
  URL: `/[locale]/{region}/{province-slug}/{department-slug}`.

  Department.slug es @@unique([provinceId, slug]) — unico dentro de
  la provincia. El loader valida la cadena completa para evitar
  URLs ambiguas (ej. dos departamentos con slug 'capital' en
  provincias distintas).

  Render dinamico (force-dynamic), igual que el resto de las geo: el
  ISR a nivel pagina rompia on-demand con DYNAMIC_SERVER_USAGE
  (getTranslations del chrome publico bajo render estatico). El cache
  de DATOS lo mantiene unstable_cache + tag department:{slug} en el loader.
*/

export const dynamic = "force-dynamic";

type PageParams = {
  locale: string;
  region: string;
  province: string;
  department: string;
};

type Props = {
  params: Promise<PageParams>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale, region, province, department } = await params;
  if (!isSupportedLocale(locale)) return {};
  setRequestLocale(locale);
  const node = await getDepartmentNode(
    region,
    province,
    department,
    locale,
  );
  if (!node) return {};
  return buildGeoMetadata(node, locale);
}

export default async function DepartmentPage({ params }: Props) {
  const { locale, region, province, department } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const node = await getDepartmentNode(region, province, department, locale);
  if (!node) notFound();

  const i18n = await buildGeoPageI18n(node);

  return <GeoPageLayout node={node} locale={locale} i18n={i18n} />;
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (routing.locales as readonly string[]).includes(locale);
}
