"use server";

import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { buildAllPaths } from "@/lib/public/buildAllPaths";

/**
 * Invalida los caches admin + tags geo (region/province/department/
 * locality) que contienen esta ficha. buildAllPaths hace UN query
 * Prisma para resolver los 4 FKs denormalizados.
 *
 * Antes del fix H1, las server actions de lifecycle solo
 * invalidaban paths admin — las paginas publicas /es/cuyo/mendoza
 * etc. quedaban con cache stale hasta el revalidate ISR de 24h.
 * Ahora una ficha publicada/archived/promovida a FEATURED se
 * refleja inmediatamente en el order top-featured y los counts del
 * PlaceCard.
 */
async function revalidateListing(id: string): Promise<void> {
  const { paths, tags } = await buildAllPaths("listing", id);
  paths.forEach((p) => revalidatePath(p));
  tags.forEach((t) => updateTag(t));
}

/*
  TODO (v0.2.b — Cloudinary): cuando se implemente `hardDeleteListing`,
  ANTES del `prisma.listing.delete()` hay que iterar las
  `ListingImage.cloudinaryPublicId` y llamar `cloudinary.uploader.destroy()`
  por cada una. La cascade de Prisma borra los rows en DB pero los
  assets en el CDN quedan huérfanos sin esto. Decisión cerrada en
  AGENTS.md (sección "Cloudinary cleanup en hard-delete de Listing").
*/

export type LifecycleResult =
  | { ok: true }
  | { ok: false; message: string };

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

const NOT_FOUND_RESULT: LifecycleResult = {
  ok: false,
  message: "La ficha no existe o fue eliminada.",
};

/**
 * Atrapa `P2025` (Record not found) de Prisma y lo convierte en un
 * `LifecycleResult` no-ok en vez de dejarlo bubble-up como excepción
 * con stack trace al cliente.
 */
function isRecordNotFoundError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

export async function publishListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return NOT_FOUND_RESULT;

  if (existing.status === "PUBLISHED") {
    return { ok: true };
  }

  try {
    await prisma.listing.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        archivedAt: null,
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}

export async function unpublishListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return NOT_FOUND_RESULT;

  if (existing.status !== "PUBLISHED") {
    return {
      ok: false,
      message: "Solo se pueden volver a borrador las fichas publicadas.",
    };
  }

  try {
    await prisma.listing.update({
      where: { id },
      data: { status: "DRAFT" },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}

export async function archiveListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  try {
    await prisma.listing.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}

export async function restoreListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  try {
    await prisma.listing.update({
      where: { id },
      data: {
        status: "DRAFT",
        archivedAt: null,
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}

export async function verifyListing(id: string): Promise<LifecycleResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return NOT_FOUND_RESULT;

  if (existing.status !== "PUBLISHED") {
    return {
      ok: false,
      message:
        "Solo se pueden verificar fichas publicadas. Publicá la ficha primero.",
    };
  }

  const now = new Date();
  try {
    await prisma.listing.update({
      where: { id },
      data: {
        verifiedAt: now,
        verifiedUntil: new Date(now.getTime() + TWELVE_MONTHS_MS),
        verifiedById: user.id,
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}

export async function unverifyListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  try {
    await prisma.listing.update({
      where: { id },
      data: {
        verifiedAt: null,
        verifiedUntil: null,
        verifiedById: null,
      },
    });
  } catch (err) {
    if (isRecordNotFoundError(err)) return NOT_FOUND_RESULT;
    throw err;
  }

  await revalidateListing(id);
  return { ok: true };
}
