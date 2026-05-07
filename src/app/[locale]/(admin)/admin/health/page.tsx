import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string }>;
};

type PostgresVersionRow = { version: string };

async function loadHealthData() {
  const [versionRows, regionsCount, usersCount] = await Promise.all([
    prisma.$queryRaw<PostgresVersionRow[]>`SELECT version()`,
    prisma.region.count(),
    prisma.user.count(),
  ]);

  return {
    postgresVersion: versionRows[0]?.version ?? "unknown",
    regionsCount,
    usersCount,
  };
}

export default async function AdminHealthPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("AdminHealth");
  const data = await loadHealthData();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-500">{t("intro")}</p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Stat label={t("postgresVersion")} value={data.postgresVersion} />
        <Stat label={t("regionsCount")} value={data.regionsCount.toString()} />
        <Stat label={t("usersCount")} value={data.usersCount.toString()} />
        <Stat label={t("currentLocale")} value={locale} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-zinc-200 p-4">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="break-words font-mono text-sm">{value}</dd>
    </div>
  );
}
