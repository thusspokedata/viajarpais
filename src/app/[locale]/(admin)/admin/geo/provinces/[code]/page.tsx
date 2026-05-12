import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { EditorialContentForm } from "@/components/admin/geo/EditorialContentForm";
import { GalleryUploader } from "@/components/admin/gallery/GalleryUploader";
import { TranslationsPanel } from "@/components/admin/TranslationsPanel";
import { entityToTranslationsView } from "@/lib/translations/view";
import { imagesToGalleryView } from "@/lib/images/view";
import { IMAGE_LIMITS } from "@/lib/images/dispatcher";
import { getProvinceByCode } from "@/server/data/geo/provinces";
import { updateProvince } from "@/server/actions/geo/update";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function EditProvincePage({ params }: Props) {
  const { code } = await params;
  const province = await getProvinceByCode(code);
  if (!province) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <Link
        href="/admin/geo/provinces"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver al listado de provincias
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          {province.name}
        </h1>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 font-mono">
          {province.code} · /{province.slug}
        </p>
      </header>

      <EditorialContentForm
        entityId={province.id}
        entityName={province.name}
        entitySlug={province.slug}
        parentLink={{
          label: "Región",
          name: province.region.nameEs,
          href: `/admin/geo/regions/${province.region.code}`,
        }}
        defaultValues={{
          taglineEs: province.taglineEs ?? undefined,
          descriptionEs: province.descriptionEs ?? undefined,
          metaTitleEs: province.metaTitleEs ?? undefined,
          metaDescriptionEs: province.metaDescriptionEs ?? undefined,
        }}
        initialUpdatedAt={province.updatedAt.toISOString()}
        stats={[
          { label: "Departamentos", value: province._count.departments },
          { label: "Localidades", value: province._count.localities },
          { label: "Fichas adentro", value: province._count.listings },
        ]}
        lastEdited={
          province.lastEditedBy
            ? {
                at: province.updatedAt.toISOString(),
                by: province.lastEditedBy.name,
              }
            : null
        }
        updateAction={updateProvince}
      />

      <TranslationsPanel
        entityType="province"
        entityId={province.id}
        revalidateIdentifier={province.code}
        translations={entityToTranslationsView(province)}
      />

      <GalleryUploader
        entityType="province"
        entityId={province.id}
        images={imagesToGalleryView(province.images)}
        maxImages={IMAGE_LIMITS.province}
      />
    </div>
  );
}
