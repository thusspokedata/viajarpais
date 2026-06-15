import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeoPageLayout } from "@/components/public";
import {
  getRegionNode,
  type SupportedLocale,
} from "@/lib/public/geoLoader";
import { buildGeoPageI18n } from "@/lib/public/geoPageI18n";
import { buildGeoMetadata } from "@/lib/public/seo";
import { routing } from "@/i18n/routing";

/*
  Pagina publica de Region — `/[locale]/{region-code}`.

  Render dinamico (force-dynamic), igual que la home publica. El
  contenido es un directorio DB-backed; el caching de DATOS lo provee
  unstable_cache en el geoLoader (con revalidateTag para invalidacion
  on-demand desde el admin), asi que force-dynamic NO pierde el cache
  de datos — solo deja de cachear el HTML.

  Por que NO ISR: el ISR a nivel pagina (revalidate + generateStaticParams
  + dynamicParams) rompia en el render on-demand de runtime con
  DYNAMIC_SERVER_USAGE — getTranslations del chrome publico (PublicFooter)
  cae a headers() bajo render estatico. El build prerender funcionaba,
  pero en prod el build usa DATABASE_URL placeholder => 0 paginas
  pre-generadas => TODO cae en on-demand => 500. force-dynamic lo evita.
*/

export const dynamic = "force-dynamic";

type PageParams = {
  locale: string;
  region: string;
};

type Props = {
  params: Promise<PageParams>;
};

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
  // Deriva del routing config — no hardcodear el allowlist.
  return (routing.locales as readonly string[]).includes(locale);
}
