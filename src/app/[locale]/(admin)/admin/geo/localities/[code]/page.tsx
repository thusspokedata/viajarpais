import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { EditorialContentForm } from "@/components/admin/geo/EditorialContentForm";
import { GeoImageList } from "@/components/admin/geo/GeoImageList";
import { FormSection } from "@/components/admin/listing-form/FormSection";
import { TranslationsPanel } from "@/components/admin/TranslationsPanel";
import { entityToTranslationsView } from "@/lib/translations/view";
import { getLocalityByCode } from "@/server/data/geo/localities";
import { updateLocality } from "@/server/actions/geo/update";
import { deleteLocalityImage } from "@/server/actions/geo/images";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function EditLocalityPage({ params }: Props) {
  const { code } = await params;
  const locality = await getLocalityByCode(code);
  if (!locality) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <Link
        href="/admin/geo/localities"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver al listado de localidades
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          {locality.name}
        </h1>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 font-mono">
          {locality.code} · {locality.province.region.nameEs} →{" "}
          {locality.province.name} → {locality.department.name}
        </p>
      </header>

      <EditorialContentForm
        entityId={locality.id}
        entityName={locality.name}
        entitySlug={locality.slug}
        parentLink={{
          label: "Departamento",
          name: locality.department.name,
          href: `/admin/geo/departments/${locality.department.code}`,
        }}
        defaultValues={{
          taglineEs: locality.taglineEs ?? undefined,
          descriptionEs: locality.descriptionEs ?? undefined,
          metaTitleEs: locality.metaTitleEs ?? undefined,
          metaDescriptionEs: locality.metaDescriptionEs ?? undefined,
        }}
        initialUpdatedAt={locality.updatedAt.toISOString()}
        stats={[{ label: "Fichas adentro", value: locality._count.listings }]}
        lastEdited={
          locality.lastEditedBy
            ? {
                at: locality.updatedAt.toISOString(),
                by: locality.lastEditedBy.name,
              }
            : null
        }
        updateAction={updateLocality}
      />

      <TranslationsPanel
        entityType="locality"
        entityId={locality.id}
        revalidateIdentifier={locality.code}
        translations={entityToTranslationsView(locality)}
      />

      <FormSection title="Imágenes" defaultOpen>
        <GeoImageList
          images={locality.images}
          deleteAction={deleteLocalityImage}
        />
      </FormSection>
    </div>
  );
}
