import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "@/components/ui/icons";
import { Card } from "@/components/ui";

export type RegionCardData = {
  code: string;
  name: string;
  provincesCount: number;
  localitiesCount: number;
};

export interface RegionsGridProps {
  regions: RegionCardData[];
}

export async function RegionsGrid({ regions }: RegionsGridProps) {
  const t = await getTranslations("Home");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {regions.map((r) => (
        <Link
          key={r.code}
          href={`/${r.code}`}
          className="group block focus:outline-none focus-visible:[&>*]:shadow-[var(--shadow-focus)]"
        >
          <Card
            variant="interactive"
            className="p-6 h-full flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              {/*
                TODO: i18n — agregar nameEn/namePtBr al schema Region en una
                migración futura si "Noroeste Argentino" / "Nordeste Argentino"
                deben traducirse a EN/PT-BR. Topónimos cortos (Cuyo, Patagonia)
                no se traducen.
              */}
              <h3 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
                {r.name}
              </h3>
              <ArrowUpRight
                className="h-5 w-5 shrink-0 text-[var(--text-muted)] transition-[color,transform] duration-[var(--duration-fast)] group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <div className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-auto">
              {t("regionCount", {
                provinces: r.provincesCount,
                localities: r.localitiesCount,
              })}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
