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
import {
  runAutoTranslation,
  type TranslationStatus,
} from "@/lib/translations/orchestrator";
import type { TranslationState } from "@/lib/translations/dispatcher";

export type UpdateListingResult =
  | {
      ok: true;
      updatedAt: string;
      reverified: boolean;
      translationStatus: TranslationStatus;
    }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
      conflict?: true;
    };

/**
 * Helper: distingue undefined (no tocar el campo en DB) de null (clear
 * explícito) para campos `Json?` de Prisma. `?? undefined` solo no
 * limpia el valor previo cuando el editor borra attributes/openingHours.
 */
function jsonOrClear(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

/**
 * `expectedUpdatedAt` opcional: si lo mandás, se chequea optimistic
 * locking via Compare-And-Swap dentro de la transacción (no fuera).
 * Si la fila no matchea por updatedAt distinto, Prisma tira `P2025` y
 * la tx se rolea entera; el caller recibe `{ ok: false, conflict: true }`.
 *
 * La transacción corre en `RepeatableRead` para que el delete+create
 * de categorías no produzca ventana donde un read concurrente vea la
 * ficha sin categorías (snapshot estable durante toda la tx).
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
      locality: { select: { slug: true } },
    },
  });
  if (!existing) {
    return { ok: false, message: "La ficha no existe o fue archivada." };
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

  /*
    Resolución de `regionId` y validación de consistencia geo:

    - Si el editor NO cambió la localidad, usamos `existing.regionId` y
      `existing.locality.slug` cacheados — evitamos un round-trip extra
      a Locality. ~80% de los updates no tocan ubicación.
    - Si cambió, fetcheamos la nueva localidad para validar que pertenece
      al departamento/provincia seleccionados Y para resolver el nuevo
      `regionId` desde la cadena.

    También validamos que `data.provinceId`/`data.departmentId` matcheen
    con la cadena real cuando localityId NO cambió pero el editor pudo
    haber cambiado uno de los selects superiores manualmente.
  */
  let localitySlug: string;
  let regionId: string;
  if (data.localityId === existing.localityId) {
    if (
      data.departmentId !== existing.departmentId ||
      data.provinceId !== existing.provinceId
    ) {
      return {
        ok: false,
        formErrors: [
          "La localidad seleccionada no pertenece al departamento o provincia indicados.",
        ],
      };
    }
    localitySlug = existing.locality.slug;
    regionId = existing.regionId;
  } else {
    const locality = await prisma.locality.findUnique({
      where: { id: data.localityId },
      select: {
        slug: true,
        departmentId: true,
        provinceId: true,
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
    localitySlug = locality.slug;
    regionId = locality.province.regionId;
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
        localitySlug,
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

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        await tx.listingCategory.deleteMany({ where: { listingId: id } });
        await tx.listingCategory.createMany({
          data: data.categories.map((c) => ({
            listingId: id,
            categoryId: c.categoryId,
            isPrimary: c.isPrimary,
          })),
        });

        /*
          Compare-And-Swap: si `expectedUpdatedAt` viene seteado, lo
          metemos en el WHERE. Si la fila cambió desde que el editor la
          abrió, Prisma tira `P2025` (record not found) y la transacción
          entera (incluido el delete/create de categorías) se rolea.
        */
        return tx.listing.update({
          where: {
            id,
            ...(expectedUpdatedAt
              ? { updatedAt: new Date(expectedUpdatedAt) }
              : {}),
          },
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
            lastEditedById: user.id,
            ...(reverify
              ? {
                  verifiedAt: null,
                  verifiedUntil: null,
                  // `verifiedById` se PRESERVA a propósito. Lo usa el
                  // banner de re-verificación: una ficha "que fue
                  // verificada y ahora no está" se detecta como
                  // `verifiedById !== null && verifiedAt === null`.
                  // Si lo borráramos, perderíamos esa señal.
                }
              : {}),
          },
          select: { updatedAt: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );

    /*
      Auto-traducción post-UPDATE. La fuente del diff es el `existing`
      que leímos antes del UPDATE — sus `*Es` son el "previo" y los
      nuevos vienen del payload. Reusamos el shape para alimentar al
      orchestrator sin un round-trip extra. Si DeepL falla o la cuota
      está agotada, el save en español queda OK; el campo con falla
      sale con `*PendingRetry=true` y el admin muestra banner naranja.
    */
    const translationStatus = await runAutoTranslation({
      type: "listing",
      id,
      previousState: existing as unknown as TranslationState,
      nextValues: {
        taglineEs: existing.taglineEs,
        descriptionEs: data.description,
      },
    });

    revalidatePath("/admin/listings");
    revalidatePath(`/admin/listings/${id}`);

    return {
      ok: true,
      updatedAt: updated.updatedAt.toISOString(),
      reverified: reverify,
      translationStatus,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return {
          ok: false,
          conflict: true,
          message:
            "La ficha cambió desde la última vez que la abriste. Recargá la página para ver los cambios.",
        };
      }
      if (err.code === "P2002") {
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
          message: "Conflicto de unicidad al guardar la ficha.",
        };
      }
    }
    throw err;
  }
}
