"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export type CreateListingResult =
  | { ok: true; id: string; slug: string }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
    };

export async function createListing(
  raw: ListingFormInput,
): Promise<CreateListingResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

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

  let slug: string;
  try {
    if (data.slug) {
      await assertSlugValidAndAvailable(prisma, data.slug);
      slug = data.slug;
    } else {
      slug = await generateUniqueSlug(prisma, data.name, locality.slug);
    }
  } catch (err) {
    if (err instanceof SlugCollisionError) {
      return {
        ok: false,
        fieldErrors: { slug: [err.message] },
      };
    }
    return {
      ok: false,
      fieldErrors: {
        slug: [err instanceof Error ? err.message : "Slug inválido."],
      },
    };
  }

  const created = await prisma.listing.create({
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
      status: "DRAFT",
      tier: "FREE",
      paymentStatus: "NONE",
      createdById: user.id,
      categories: {
        create: data.categories.map((c) => ({
          categoryId: c.categoryId,
          isPrimary: c.isPrimary,
        })),
      },
    },
    select: { id: true, slug: true },
  });

  revalidatePath("/admin/listings");
  redirect(`/admin/listings/${created.id}?created=1`);
}
