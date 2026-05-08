import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { ListingFormShell } from "@/components/admin/listing-form/ListingFormShell";
import { getListingForEdit } from "@/server/data/listings";
import {
  listProvinces,
  listDepartmentsByProvince,
  listLocalitiesByDepartment,
  listCategories,
} from "@/server/data/geo";
import type { ListingFormInput } from "@/lib/listings/validation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const listing = await getListingForEdit(id);
  if (!listing) notFound();

  const [provinces, categories, departments, localities] = await Promise.all([
    listProvinces(),
    listCategories(),
    listDepartmentsByProvince(listing.provinceId),
    listLocalitiesByDepartment(listing.departmentId),
  ]);

  const defaultValues: ListingFormInput = {
    name: listing.name,
    slug: listing.slug,
    description: listing.description,
    provinceId: listing.provinceId,
    departmentId: listing.departmentId,
    localityId: listing.localityId,
    address: listing.address,
    lat: listing.lat ?? undefined,
    lng: listing.lng ?? undefined,
    phone: listing.phone ?? undefined,
    whatsapp: listing.whatsapp ?? undefined,
    email: listing.email ?? undefined,
    website: listing.website ?? undefined,
    instagram: listing.instagram ?? undefined,
    facebook: listing.facebook ?? undefined,
    tiktok: listing.tiktok ?? undefined,
    youtube: listing.youtube ?? undefined,
    priceRange: listing.priceRange ?? null,
    openingHours: (listing.openingHours as ListingFormInput["openingHours"]) ?? null,
    paymentMethods: listing.paymentMethods ?? [],
    languages: listing.languages ?? [],
    attributes:
      typeof listing.attributes === "object" && listing.attributes !== null
        ? (listing.attributes as Record<string, unknown>)
        : undefined,
    metaTitle: listing.metaTitle ?? undefined,
    metaDescription: listing.metaDescription ?? undefined,
    categories: listing.categories.map((c) => ({
      categoryId: c.categoryId,
      isPrimary: c.isPrimary,
    })),
  };

  /*
    needsReverify: heurística para que el banner aparezca cuando una
    ficha en DRAFT/PUBLISHED tiene `verifiedAt=null` pero antes estaba
    verificada. v0.2.a no rastrea historial — usamos un proxy: si la
    ficha tiene `verifiedUntil=null` Y fue editada después de haberse
    creado (updatedAt > createdAt + 1min) ESTÁ pendiente de verificar.
    En la práctica el banner aparece para fichas previamente verificadas
    cuyo updateListing reseteó verifiedAt; las nunca-verificadas también
    "necesitan verificación" pero el copy del banner sigue aplicando.

    Para el smoke test del usuario (#5): cuando el editor cambia el
    nombre de una ficha verificada, el server action resetea verifiedAt
    a null y el reload acá hace que el banner se muestre.
  */
  const needsReverify =
    listing.verifiedAt === null &&
    listing.status !== "ARCHIVED" &&
    listing.updatedAt.getTime() - listing.createdAt.getTime() > 60_000;

  const justCreated = sp.created === "1";

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
          {listing.name}
        </h1>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 font-mono">
          /{listing.slug}
        </p>
      </header>

      <ListingFormShell
        mode="edit"
        defaultValues={defaultValues}
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
        listingId={listing.id}
        listingStatus={listing.status}
        listingTier={listing.tier}
        listingUpdatedAt={listing.updatedAt.toISOString()}
        listingVerifiedAt={listing.verifiedAt?.toISOString() ?? null}
        listingVerifiedUntil={listing.verifiedUntil?.toISOString() ?? null}
        listingArchivedAt={listing.archivedAt?.toISOString() ?? null}
        needsReverify={needsReverify}
        justCreated={justCreated}
      />
    </div>
  );
}
