import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";
import { EditorialContentForm } from "@/components/admin/geo/EditorialContentForm";
import { GeoImageList } from "@/components/admin/geo/GeoImageList";
import { FormSection } from "@/components/admin/listing-form/FormSection";
import { getDepartmentByCode } from "@/server/data/geo/departments";
import { updateDepartment } from "@/server/actions/geo/update";
import { deleteDepartmentImage } from "@/server/actions/geo/images";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function EditDepartmentPage({ params }: Props) {
  const { code } = await params;
  const department = await getDepartmentByCode(code);
  if (!department) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <Link
        href="/admin/geo/departments"
        className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver al listado de departamentos
      </Link>
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          {department.name}
        </h1>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 font-mono">
          {department.code} · {department.province.name},{" "}
          {department.province.region.nameEs}
        </p>
      </header>

      <EditorialContentForm
        entityId={department.id}
        entityName={department.name}
        entitySlug={department.slug}
        parentLink={{
          label: "Provincia",
          name: department.province.name,
          href: `/admin/geo/provinces/${department.province.code}`,
        }}
        defaultValues={{
          taglineEs: department.taglineEs ?? undefined,
          descriptionEs: department.descriptionEs ?? undefined,
          metaTitleEs: department.metaTitleEs ?? undefined,
          metaDescriptionEs: department.metaDescriptionEs ?? undefined,
        }}
        initialUpdatedAt={department.updatedAt.toISOString()}
        stats={[
          { label: "Localidades", value: department._count.localities },
          { label: "Fichas adentro", value: department._count.listings },
        ]}
        lastEdited={
          department.lastEditedBy
            ? {
                at: department.updatedAt.toISOString(),
                by: department.lastEditedBy.name,
              }
            : null
        }
        updateAction={updateDepartment}
      />

      <FormSection title="Imágenes" defaultOpen>
        <GeoImageList
          images={department.images}
          deleteAction={deleteDepartmentImage}
        />
      </FormSection>
    </div>
  );
}
