import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { CascadeGeoFilters } from "@/components/admin/geo/CascadeGeoFilters";
import { listRegionsWithStats } from "@/server/data/geo/regions";
import { listProvincesWithStats } from "@/server/data/geo/provinces";
import { listDepartmentsWithStats } from "@/server/data/geo/departments";
import { listLocalitiesWithStats } from "@/server/data/geo/localities";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function LocalitiesIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const regionId = asSingle(sp.regionId);
  const provinceId = asSingle(sp.provinceId);
  const departmentId = asSingle(sp.departmentId);
  const search = asSingle(sp.search);
  const pageRaw = Number(asSingle(sp.page) ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  /*
    Departamentos: solo precargo los de la provincia actualmente
    seleccionada (si la hay). Sin filtro de provincia, no precargo nada
    — son ~530 deptos, demasiado para un select. El editor primero
    debe elegir provincia para que aparezca el filtro de departamento.
  */
  const [{ items, total, pageCount }, regions, provinces, departments] =
    await Promise.all([
      listLocalitiesWithStats({
        regionId,
        provinceId,
        departmentId,
        search,
        page,
      }),
      listRegionsWithStats(),
      listProvincesWithStats(),
      provinceId
        ? listDepartmentsWithStats({ provinceId, pageSize: 200 }).then(
            (r) => r.items,
          )
        : Promise.resolve([]),
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
          Localidades
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
          ~3.350 localidades. Filtrá región → provincia → departamento, o
          buscá por nombre.
        </p>
      </header>

      <CascadeGeoFilters
        basePath="/admin/geo/localities"
        levels={["region", "province", "department"]}
        regions={regions.map((r) => ({ id: r.id, name: r.nameEs }))}
        provinces={provinces.map((p) => ({
          id: p.id,
          name: p.name,
          regionId: p.regionId,
        }))}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          provinceId: d.provinceId,
        }))}
        showSearch
        searchPlaceholder="Buscar localidad por nombre…"
      />

      <div className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)] overflow-hidden">
        <table className="w-full text-[var(--text-sm)]">
          <thead className="bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Nombre
              </th>
              <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                Jerarquía
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
            {items.map((l) => (
              <tr
                key={l.id}
                className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]/50"
              >
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/admin/geo/localities/${l.code}`}
                    className="font-medium text-[var(--text-primary)] hover:text-[var(--text-link)]"
                  >
                    {l.name}
                  </Link>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] font-mono mt-0.5">
                    /{l.slug}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-[var(--text-secondary)] text-[var(--text-xs)]">
                  {l.province.region.nameEs} → {l.province.name} →{" "}
                  {l.department.name}
                </td>
                <td className="px-4 py-3 align-top text-right font-mono text-[var(--text-xs)]">
                  {l._count.listings}
                </td>
                <td className="px-4 py-3 align-top text-[var(--text-xs)] text-[var(--text-muted)] max-w-xs">
                  {l.taglineEs ? (
                    <span className="line-clamp-1">{l.taglineEs}</span>
                  ) : (
                    <span className="italic">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/admin/geo/localities/${l.code}`}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`Editar ${l.name}`}
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
          {items.length} de {total.toLocaleString("es-AR")} localidades
        </span>
        <span>
          Página {page} de {pageCount}
        </span>
      </div>
    </div>
  );
}
