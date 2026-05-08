import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchBar } from "@/components/public/SearchBar";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");

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
    </>
  );
}
