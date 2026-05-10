import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchBar } from "@/components/public/SearchBar";
import { RegionsGrid, type RegionCardData } from "@/components/public/RegionsGrid";
import {
  CategoriesGrid,
  type CategoryCardData,
} from "@/components/public/CategoriesGrid";
import { VerifiedBadge } from "@/components/ui";
import { Check } from "@/components/ui/icons";
import { prisma } from "@/lib/db";

/*
  Render dinámico para destrabar el build en CI: el job de CI no expone
  un Postgres real (DATABASE_URL es placeholder), así que el prerender
  estático falla al ejecutar las queries Prisma de regiones y categorías.
  Cuando v0.3 introduzca PPR + Cache Components, revisitamos.
*/
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

async function loadRegions(): Promise<RegionCardData[]> {
  const regions = await prisma.region.findMany({
    orderBy: { order: "asc" },
    include: {
      provinces: {
        include: {
          _count: { select: { localities: true } },
        },
      },
    },
  });

  return regions.map((r) => ({
    code: r.code,
    // Por ahora español. v0.4 va a leer `r.nameEn`/`r.namePtBr` según
    // el `locale` del request. Comentario `TODO: i18n` en RegionsGrid
    // ya documentaba esto antes de que las columnas existieran.
    name: r.nameEs,
    provincesCount: r.provinces.length,
    localitiesCount: r.provinces.reduce(
      (sum, p) => sum + p._count.localities,
      0
    ),
  }));
}

async function loadCategories(locale: string): Promise<CategoryCardData[]> {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: locale === "en" ? c.nameEn : locale === "pt-BR" ? c.namePtBr : c.nameEs,
  }));
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, regions, categories] = await Promise.all([
    getTranslations("Home"),
    loadRegions(),
    loadCategories(locale),
  ]);

  return (
    <>
      <section className="bg-[var(--surface-canvas)] border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28 md:py-32 text-center">
          <h1
            className="font-display text-[var(--text-4xl)] sm:text-[var(--text-5xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]"
          >
            {t("heroTitle")}
          </h1>
          <p
            className="mt-5 sm:mt-6 text-[var(--text-md)] sm:text-[var(--text-lg)] leading-[var(--leading-snug)] text-[var(--text-secondary)]"
          >
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 sm:mt-12 mx-auto max-w-xl">
            <SearchBar placeholder={t("searchPlaceholder")} />
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-base)]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <header className="max-w-2xl mb-10 sm:mb-12">
            <h2 className="font-display text-[var(--text-3xl)] sm:text-[var(--text-4xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
              {t("regionsHeading")}
            </h2>
            <p className="mt-3 text-[var(--text-md)] text-[var(--text-secondary)]">
              {t("regionsSubheading")}
            </p>
          </header>
          <RegionsGrid regions={regions} />
        </div>
      </section>

      <section className="bg-[var(--surface-canvas)] border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <header className="max-w-2xl mb-10 sm:mb-12">
            <h2 className="font-display text-[var(--text-3xl)] sm:text-[var(--text-4xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
              {t("categoriesHeading")}
            </h2>
            <p className="mt-3 text-[var(--text-md)] text-[var(--text-secondary)]">
              {t("categoriesSubheading")}
            </p>
          </header>
          <CategoriesGrid categories={categories} />
        </div>
      </section>

      <TrustSection />
    </>
  );
}

async function TrustSection() {
  const t = await getTranslations("Home");
  /*
    Fechas relativas: badge siempre en estado "active" como demo
    institucional. Las fichas reales tendrán fechas propias.
  */
  const verifiedAt = new Date();
  verifiedAt.setMonth(verifiedAt.getMonth() - 1);
  const expiresAt = new Date(verifiedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const points = [
    t("trustPoint1"),
    t("trustPoint2"),
    t("trustPoint3"),
    t("trustPoint4"),
  ];

  return (
    <section className="bg-[var(--surface-base)] border-t border-[var(--border-subtle)]">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24 text-center">
        <div className="inline-flex">
          <VerifiedBadge
            size="lg"
            verifiedAt={verifiedAt.toISOString()}
            expiresAt={expiresAt.toISOString()}
          />
        </div>
        <h2 className="mt-8 font-display text-[var(--text-3xl)] sm:text-[var(--text-4xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          {t("trustHeading")}
        </h2>
        <p className="mt-4 text-[var(--text-md)] sm:text-[var(--text-lg)] leading-[var(--leading-snug)] text-[var(--text-secondary)] max-w-2xl mx-auto">
          {t("trustSubheading")}
        </p>
        <ul className="mt-12 grid gap-3 sm:gap-4 sm:grid-cols-2 text-left">
          {points.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-canvas)]"
            >
              <span
                aria-hidden
                className="grid place-items-center h-6 w-6 shrink-0 rounded-[var(--radius-pill)] bg-[var(--verified-bg)] text-[var(--verified-fg)] mt-0.5"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="text-[var(--text-sm)] sm:text-[var(--text-base)] leading-[var(--leading-snug)] text-[var(--text-primary)]">
                {p}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
