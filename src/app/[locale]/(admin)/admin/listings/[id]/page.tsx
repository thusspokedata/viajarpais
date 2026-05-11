import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { ListingFormShell } from "@/components/admin/listing-form/ListingFormShell";
import { TranslationsPanel } from "@/components/admin/TranslationsPanel";
import { GalleryUploader } from "@/components/admin/gallery/GalleryUploader";
import { entityToTranslationsView } from "@/lib/translations/view";
import { imagesToGalleryView } from "@/lib/images/view";
import { IMAGE_LIMITS } from "@/lib/images/dispatcher";
import { getListingForEdit } from "@/server/data/listings";
import {
  listProvinces,
  listDepartmentsByProvince,
  listLocalitiesByDepartment,
  listCategories,
} from "@/server/data/geo";
import {
  OpeningHoursSchema,
  type ListingFormInput,
} from "@/lib/listings/validation";

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
    // El form todavía usa `description` (single field). Cuando v0.3-geo-b
    // cablee DeepL, el form va a manejar las 3 traducciones.
    description: listing.descriptionEs,
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
    /*
      `openingHours` viene como `Json?` desde Prisma — el schema NO
      garantiza la shape esperada por el form. Si una migración futura
      cambia la estructura o si un row tiene formato viejo, el cast
      directo dejaba pasar data inválida hasta que el form se rompía
      silenciosamente. `OpeningHoursSchema.catch(null).parse()` valida
      en runtime: si la shape no matchea, cae a `null` y el form
      muestra "sin horarios" en lugar de explotar.
    */
    openingHours: OpeningHoursSchema.catch(null).parse(listing.openingHours),
    paymentMethods: listing.paymentMethods ?? [],
    languages: listing.languages ?? [],
    attributes:
      typeof listing.attributes === "object" && listing.attributes !== null
        ? (listing.attributes as Record<string, unknown>)
        : undefined,
    metaTitle: listing.metaTitleEs ?? undefined,
    metaDescription: listing.metaDescriptionEs ?? undefined,
    categories: listing.categories.map((c) => ({
      categoryId: c.categoryId,
      isPrimary: c.isPrimary,
    })),
  };

  /*
    needsReverify: detección directa, sin heurística temporal.
    `verifiedById !== null && verifiedAt === null` = "esta ficha fue
    verificada por alguien y ahora está en estado no-verificado". La
    señal funciona porque `updateListing` resetea `verifiedAt` cuando
    se cambian campos críticos pero PRESERVA `verifiedById` (ver el
    commit anterior `fix(db): updateListing CAS + ...`). Así una ficha
    nunca-verificada (`verifiedById=null`) NO dispara el banner aunque
    se la edite muchas veces, y una ficha previamente verificada cuyo
    `verifiedAt` se reseteó SÍ lo dispara.
  */
  const needsReverify =
    listing.verifiedById !== null && listing.verifiedAt === null;

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

      <TranslationsPanel
        entityType="listing"
        entityId={listing.id}
        revalidateIdentifier={listing.id}
        translations={entityToTranslationsView(listing)}
      />

      <GalleryUploader
        entityType="listing"
        entityId={listing.id}
        images={imagesToGalleryView(listing.images)}
        maxImages={IMAGE_LIMITS.listing}
      />
    </div>
  );
}
