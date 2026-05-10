import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { EditorialContentForm } from "@/components/admin/geo/EditorialContentForm";
import { GeoImageList } from "@/components/admin/geo/GeoImageList";
import { FormSection } from "@/components/admin/listing-form/FormSection";
import { getRegionByCode } from "@/server/data/geo/regions";
import { updateRegion } from "@/server/actions/geo/update";
import { deleteRegionImage } from "@/server/actions/geo/images";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function EditRegionPage({ params }: Props) {
  const { code } = await params;
  const region = await getRegionByCode(code);
  if (!region) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <Link
        href="/admin/geo"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver al listado
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          {region.nameEs}
        </h1>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 font-mono">
          {region.code}
        </p>
      </header>

      <EditorialContentForm
        entityId={region.id}
        entityName={region.nameEs}
        entitySlug={region.code}
        parentLink={null}
        defaultValues={{
          taglineEs: region.taglineEs ?? undefined,
          descriptionEs: region.descriptionEs ?? undefined,
          metaTitleEs: region.metaTitleEs ?? undefined,
          metaDescriptionEs: region.metaDescriptionEs ?? undefined,
        }}
        initialUpdatedAt={region.updatedAt.toISOString()}
        stats={[
          { label: "Provincias", value: region.counts.provinces },
          { label: "Departamentos", value: region.counts.departments },
          { label: "Localidades", value: region.counts.localities },
          { label: "Fichas adentro", value: region.counts.listings },
        ]}
        lastEdited={
          region.lastEditedBy
            ? {
                at: region.updatedAt.toISOString(),
                by: region.lastEditedBy.name,
              }
            : null
        }
        updateAction={updateRegion}
      />

      <FormSection title="Imágenes" defaultOpen>
        <GeoImageList
          images={region.images}
          deleteAction={deleteRegionImage}
        />
      </FormSection>
    </div>
  );
}
