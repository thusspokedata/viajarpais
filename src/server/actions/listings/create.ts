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

/**
 * Helper: distingue undefined (no incluir el campo en el create) de
 * null (clear explícito) para campos `Json?`. En create no es tan
 * crítico como en update — Prisma trata undefined como "usar default"
 * que es null — pero usamos el mismo patrón por consistencia.
 */
function jsonOrClear(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

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
    select: {
      slug: true,
      departmentId: true,
      provinceId: true,
      // Resolución de `regionId` para denormalización en Listing.
      province: { select: { regionId: true } },
    },
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
  const regionId = locality.province.regionId;

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

  let created: { id: string; slug: string };
  try {
    created = await prisma.listing.create({
      data: {
        name: data.name,
        slug,
        descriptionEs: data.description,
        regionId,
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
        openingHours: jsonOrClear(data.openingHours),
        paymentMethods: data.paymentMethods,
        languages: data.languages,
        attributes: jsonOrClear(data.attributes),
        metaTitleEs: data.metaTitle ?? null,
        metaDescriptionEs: data.metaDescription ?? null,
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
  } catch (err) {
    /*
      Race entre `assertSlugValidAndAvailable`/`generateUniqueSlug` y
      `prisma.listing.create()`: otra request puede tomar el slug en
      la ventana del medio. La unique constraint del schema atrapa el
      duplicado y Prisma tira P2002. También cubre el partial unique
      de `ListingCategory(listingId) WHERE isPrimary=true` por si zod
      fallara en garantizar exactamente una primaria (defensa en
      profundidad).
    */
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(",") : String(target ?? "");
      if (targetStr.includes("slug")) {
        return {
          ok: false,
          fieldErrors: {
            slug: ["Otro editor acaba de tomar este slug. Probá con otro."],
          },
        };
      }
      if (targetStr.includes("isPrimary")) {
        return {
          ok: false,
          fieldErrors: {
            categories: [
              "Conflicto al guardar la categoría primaria. Reintentá.",
            ],
          },
        };
      }
      return {
        ok: false,
        message: "Conflicto de unicidad al crear la ficha.",
      };
    }
    throw err;
  }

  revalidatePath("/admin/listings");
  redirect(`/admin/listings/${created.id}?created=1`);
}
