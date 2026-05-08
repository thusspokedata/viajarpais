import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchBar } from "@/components/public/SearchBar";
import { RegionsGrid, type RegionCardData } from "@/components/public/RegionsGrid";
import {
  CategoriesGrid,
  type CategoryCardData,
} from "@/components/public/CategoriesGrid";
import { prisma } from "@/lib/db";

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
    name: r.name,
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
    </>
  );
}
