import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { CascadeGeoFilters } from "@/components/admin/geo/CascadeGeoFilters";
import { listRegionsWithStats } from "@/server/data/geo/regions";
import { listProvincesWithStats } from "@/server/data/geo/provinces";
import { listDepartmentsWithStats } from "@/server/data/geo/departments";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function DepartmentsIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const regionId = asSingle(sp.regionId);
  const provinceId = asSingle(sp.provinceId);
  const search = asSingle(sp.search);
  const pageRaw = Number(asSingle(sp.page) ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const [{ items, total, pageCount }, regions, provinces] = await Promise.all([
    listDepartmentsWithStats({ regionId, provinceId, search, page }),
    listRegionsWithStats(),
    listProvincesWithStats(),
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
          Departamentos
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
          ~530 departamentos. Filtrá por región y/o provincia, o buscá
          por nombre.
        </p>
      </header>

      <CascadeGeoFilters
        basePath="/admin/geo/departments"
        levels={["region", "province"]}
        regions={regions.map((r) => ({ id: r.id, name: r.nameEs }))}
        provinces={provinces.map((p) => ({
          id: p.id,
          name: p.name,
          regionId: p.regionId,
        }))}
        departments={[]}
        showSearch
        searchPlaceholder="Buscar departamento por nombre…"
      />

      <div className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)] overflow-hidden">
        <table className="w-full text-[var(--text-sm)]">
          <thead className="bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Nombre
              </th>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Provincia
              </th>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Región
              </th>
              <th className="text-right font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Locs.
              </th>
              <th className="text-right font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Fichas
              </th>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Tagline
              </th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr
                key={d.id}
                className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]/50"
              >
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/admin/geo/departments/${d.code}`}
                    className="font-medium text-[var(--text-primary)] hover:text-[var(--text-link)]"
                  >
                    {d.name}
                  </Link>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] font-mono mt-0.5">
                    /{d.slug}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-[var(--text-secondary)]">
                  {d.province.name}
                </td>
                <td className="px-4 py-3 align-top text-[var(--text-muted)] text-[var(--text-xs)]">
                  {d.province.region.nameEs}
                </td>
                <td className="px-4 py-3 align-top text-right font-mono text-[var(--text-xs)]">
                  {d._count.localities}
                </td>
                <td className="px-4 py-3 align-top text-right font-mono text-[var(--text-xs)]">
                  {d._count.listings}
                </td>
                <td className="px-4 py-3 align-top text-[var(--text-xs)] text-[var(--text-muted)] max-w-xs">
                  {d.taglineEs ? (
                    <span className="line-clamp-1">{d.taglineEs}</span>
                  ) : (
                    <span className="italic">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/admin/geo/departments/${d.code}`}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`Editar ${d.name}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--text-muted)]">
        <span>
          {items.length} de {total.toLocaleString("es-AR")} departamentos
        </span>
        <span>
          Página {page} de {pageCount}
        </span>
      </div>
    </div>
  );
}
