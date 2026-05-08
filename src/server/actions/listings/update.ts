"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  assertSlugValidAndAvailable,
  generateUniqueSlug,
  SlugCollisionError,
} from "@/lib/slug";
import {
  ListingFormSchema,
  type ListingFormInput,
} from "@/lib/listings/validation";
import { findChangedCriticalFields } from "@/lib/listings/critical-fields";

export type UpdateListingResult =
  | { ok: true; updatedAt: string; reverified: boolean }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
      conflict?: true;
    };

/**
 * `expectedUpdatedAt` opcional: si lo mandás, se chequea optimistic
 * locking. Útil para detectar conflictos entre autosave y submit
 * manual. Si no coincide, devuelve `{ ok: false, conflict: true }` y el
 * cliente puede mostrar UI de conflicto.
 */
export async function updateListing(
  id: string,
  raw: ListingFormInput,
  expectedUpdatedAt?: string,
): Promise<UpdateListingResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const existing = await prisma.listing.findUnique({
    where: { id },
    include: {
      categories: { select: { categoryId: true, isPrimary: true } },
    },
  });
  if (!existing) {
    return { ok: false, message: "La ficha no existe o fue archivada." };
  }

  if (
    expectedUpdatedAt &&
    new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
  ) {
    return {
      ok: false,
      conflict: true,
      message:
        "La ficha cambió desde la última vez que la abriste. Recargá la página para ver los cambios.",
    };
  }

  const parsed = ListingFormSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      formErrors: flat.formErrors,
      fieldErrors: Object.fromEntries(
        Object.entries(flat.fieldErrors).filter(
          ([, v]) => Array.isArray(v) && v.length > 0,
        ),
      ) as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  const locality = await prisma.locality.findUnique({
    where: { id: data.localityId },
    select: { slug: true, departmentId: true, provinceId: true },
  });
  if (!locality) {
    return { ok: false, fieldErrors: { localityId: ["Localidad inválida."] } };
  }
  if (
    locality.departmentId !== data.departmentId ||
    locality.provinceId !== data.provinceId
  ) {
    return {
      ok: false,
      formErrors: [
        "La localidad seleccionada no pertenece al departamento o provincia indicados.",
      ],
    };
  }

  const validCategories = await prisma.category.findMany({
    where: { id: { in: data.categories.map((c) => c.categoryId) } },
    select: { id: true },
  });
  if (validCategories.length !== data.categories.length) {
    return { ok: false, fieldErrors: { categories: ["Alguna categoría no existe."] } };
  }

  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) {
    try {
      await assertSlugValidAndAvailable(prisma, data.slug, existing.id);
      slug = data.slug;
    } catch (err) {
      return {
        ok: false,
        fieldErrors: {
          slug: [err instanceof Error ? err.message : "Slug inválido."],
        },
      };
    }
  } else if (!data.slug && data.name !== existing.name) {
    /*
      Si el editor borró el slug del form Y cambió el nombre, regenerar
      del nombre nuevo. Si no cambió el nombre, mantener el slug actual.
    */
    try {
      slug = await generateUniqueSlug(
        prisma,
        data.name,
        locality.slug,
        existing.id,
      );
    } catch (err) {
      if (err instanceof SlugCollisionError) {
        return { ok: false, fieldErrors: { slug: [err.message] } };
      }
      return {
        ok: false,
        fieldErrors: {
          slug: [err instanceof Error ? err.message : "Slug inválido."],
        },
      };
    }
  }

  const changedCritical = findChangedCriticalFields(
    {
      name: existing.name,
      address: existing.address,
      provinceId: existing.provinceId,
      departmentId: existing.departmentId,
      localityId: existing.localityId,
      categories: existing.categories,
    },
    {
      name: data.name,
      address: data.address,
      provinceId: data.provinceId,
      departmentId: data.departmentId,
      localityId: data.localityId,
      categories: data.categories,
    },
  );
  const wasVerified = existing.verifiedAt !== null;
  const reverify = wasVerified && changedCritical.length > 0;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.listingCategory.deleteMany({ where: { listingId: id } });
    await tx.listingCategory.createMany({
      data: data.categories.map((c) => ({
        listingId: id,
        categoryId: c.categoryId,
        isPrimary: c.isPrimary,
      })),
    });

    return tx.listing.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description,
        provinceId: data.provinceId,
        departmentId: data.departmentId,
        localityId: data.localityId,
        address: data.address,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        instagram: data.instagram ?? null,
        facebook: data.facebook ?? null,
        tiktok: data.tiktok ?? null,
        youtube: data.youtube ?? null,
        priceRange: data.priceRange ?? null,
        openingHours: data.openingHours ?? undefined,
        paymentMethods: data.paymentMethods,
        languages: data.languages,
        attributes: (data.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        lastEditedById: user.id,
        ...(reverify
          ? {
              verifiedAt: null,
              verifiedUntil: null,
              verifiedById: null,
            }
          : {}),
      },
      select: { updatedAt: true },
    });
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);

  return {
    ok: true,
    updatedAt: updated.updatedAt.toISOString(),
    reverified: reverify,
  };
}
