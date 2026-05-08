import Link from "next/link";
import { Plus } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui";
import { ListingsTable } from "@/components/admin/listings/ListingsTable";
import { ListingsFilters } from "@/components/admin/listings/ListingsFilters";
import { ListingsPagination } from "@/components/admin/listings/ListingsPagination";
import {
  listListings,
  DEFAULT_PAGE_SIZE,
} from "@/server/data/listings";
import {
  listProvinces,
  listDepartmentsByProvince,
  listLocalitiesByDepartment,
  listCategories,
} from "@/server/data/geo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
function asMulti(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = asSingle(sp.search);
  const provinceId = asSingle(sp.provinceId);
  const departmentId = asSingle(sp.departmentId);
  const localityId = asSingle(sp.localityId);
  const categoryId = asSingle(sp.categoryId);
  const verified = (asSingle(sp.verified) as "yes" | "no" | "all" | undefined) ?? "all";
  const status = asMulti(sp.status) as ("DRAFT" | "PUBLISHED" | "ARCHIVED")[];
  const tier = asMulti(sp.tier) as ("FREE" | "PAID" | "FEATURED")[];
  const pageRaw = Number(asSingle(sp.page) ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const [{ items, total, pageCount }, provinces, categories, departments, localities] =
    await Promise.all([
      listListings(
        {
          search,
          provinceId,
          departmentId,
          localityId,
          categoryId,
          verified,
          status,
          tier,
        },
        { page, pageSize: DEFAULT_PAGE_SIZE },
      ),
      listProvinces(),
      listCategories(),
      provinceId ? listDepartmentsByProvince(provinceId) : Promise.resolve([]),
      departmentId
        ? listLocalitiesByDepartment(departmentId)
        : Promise.resolve([]),
    ]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
            Fichas
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
            Carga, edición y verificación del directorio.
          </p>
        </div>
        <Link href="/admin/listings/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          Crear ficha
        </Link>
      </header>

      <ListingsFilters
        provinces={provinces}
        initialDepartments={departments}
        initialLocalities={localities}
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          nameEs: c.nameEs,
          nameSingularEs: c.nameSingularEs,
          icon: c.icon,
        }))}
      />

      <ListingsTable items={items} />

      <ListingsPagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  );
}
