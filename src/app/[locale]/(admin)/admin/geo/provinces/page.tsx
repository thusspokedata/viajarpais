import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { RegionFilterSelect } from "@/components/admin/geo/RegionFilterSelect";
import { Th, Td } from "@/components/admin/geo/Table";
import { listRegionOptions } from "@/server/data/geo/regions";
import { listProvincesWithStats } from "@/server/data/geo/provinces";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ProvincesIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const regionId = asSingle(sp.regionId);

  const [provinces, regions] = await Promise.all([
    listProvincesWithStats({ regionId }),
    listRegionOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <Link
        href="/admin/geo"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver a Geografía
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          Provincias
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
          24 provincias argentinas. Filtrá por región para acotar.
        </p>
      </header>

      <RegionFilterSelect
        basePath="/admin/geo/provinces"
        regions={regions.map((r) => ({ id: r.id, nameEs: r.nameEs }))}
      />

      <div className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)] overflow-hidden">
        <table className="w-full text-[var(--text-sm)]">
          <thead className="bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
            <tr>
              <Th>Nombre</Th>
              <Th>Región</Th>
              <Th className="text-right">Deptos</Th>
              <Th className="text-right">Locs.</Th>
              <Th className="text-right">Fichas</Th>
              <Th>Tagline</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((p) => (
              <tr
                key={p.id}
                className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]/50"
              >
                <Td>
                  <Link
                    href={`/admin/geo/provinces/${p.code}`}
                    className="font-medium text-[var(--text-primary)] hover:text-[var(--text-link)]"
                  >
                    {p.name}
                  </Link>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] font-mono mt-0.5">
                    /{p.slug}
                  </div>
                </Td>
                <Td className="text-[var(--text-secondary)]">
                  {p.region.nameEs}
                </Td>
                <Td className="text-right font-mono text-[var(--text-xs)]">
                  {p._count.departments}
                </Td>
                <Td className="text-right font-mono text-[var(--text-xs)]">
                  {p._count.localities}
                </Td>
                <Td className="text-right font-mono text-[var(--text-xs)]">
                  {p._count.listings}
                </Td>
                <Td className="text-[var(--text-xs)] text-[var(--text-muted)] max-w-xs">
                  {p.taglineEs ? (
                    <span className="line-clamp-1">{p.taglineEs}</span>
                  ) : (
                    <span className="italic">—</span>
                  )}
                </Td>
                <Td>
                  <Link
                    href={`/admin/geo/provinces/${p.code}`}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`Editar ${p.name}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
        {provinces.length} provincia{provinces.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
