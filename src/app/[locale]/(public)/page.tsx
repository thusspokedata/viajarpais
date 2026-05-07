import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        {t("tagline")}
      </p>
      <p className="max-w-xl text-sm text-zinc-500">{t("intro")}</p>
    </section>
  );
}
