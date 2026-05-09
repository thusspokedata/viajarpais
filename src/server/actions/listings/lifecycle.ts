"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
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

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}
