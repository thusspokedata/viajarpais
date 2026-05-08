import Link from "next/link";
import { ChevronLeft } from "@/components/ui/icons";
import { ListingFormShell } from "@/components/admin/listing-form/ListingFormShell";
import { listProvinces, listCategories } from "@/server/data/geo";
import type { ListingFormInput } from "@/lib/listings/validation";

const EMPTY_DEFAULTS: ListingFormInput = {
  name: "",
  slug: undefined,
  description: "",
  provinceId: "",
  departmentId: "",
  localityId: "",
  address: "",
  lat: undefined,
  lng: undefined,
  phone: undefined,
  whatsapp: undefined,
  email: undefined,
  website: undefined,
  instagram: undefined,
  facebook: undefined,
  tiktok: undefined,
  youtube: undefined,
  priceRange: null,
  openingHours: null,
  paymentMethods: [],
  languages: [],
  attributes: undefined,
  metaTitle: undefined,
  metaDescription: undefined,
  categories: [],
};

export default async function NewListingPage() {
  const [provinces, categories] = await Promise.all([
    listProvinces(),
    listCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <Link
        href="/admin/listings"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver al listado
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          Nueva ficha
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
          Cargá los datos esenciales. Cuando guardes, la ficha queda como
          borrador y podés seguir editándola con autosave.
        </p>
      </header>

      <ListingFormShell
        mode="create"
        defaultValues={EMPTY_DEFAULTS}
        provinces={provinces}
        initialDepartments={[]}
        initialLocalities={[]}
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          nameEs: c.nameEs,
          nameSingularEs: c.nameSingularEs,
          icon: c.icon,
        }))}
      />
    </div>
  );
}
