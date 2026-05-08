"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

export type LifecycleResult =
  | { ok: true }
  | { ok: false; message: string };

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

function ensureExists<T>(value: T | null, label: string) {
  if (!value) throw new Error(`${label} no encontrada.`);
  return value;
}

export async function publishListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const existing = ensureExists(
    await prisma.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    }),
    "Ficha",
  );

  if (existing.status === "PUBLISHED") {
    return { ok: true };
  }

  await prisma.listing.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      archivedAt: null,
    },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}

export async function unpublishListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const existing = ensureExists(
    await prisma.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    }),
    "Ficha",
  );

  if (existing.status !== "PUBLISHED") {
    return {
      ok: false,
      message: "Solo se pueden volver a borrador las fichas publicadas.",
    };
  }

  await prisma.listing.update({
    where: { id },
    data: { status: "DRAFT" },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}

export async function archiveListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  await prisma.listing.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}

export async function restoreListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  await prisma.listing.update({
    where: { id },
    data: {
      status: "DRAFT",
      archivedAt: null,
    },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}

export async function verifyListing(id: string): Promise<LifecycleResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const existing = ensureExists(
    await prisma.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    }),
    "Ficha",
  );

  if (existing.status !== "PUBLISHED") {
    return {
      ok: false,
      message:
        "Solo se pueden verificar fichas publicadas. Publicá la ficha primero.",
    };
  }

  const now = new Date();
  await prisma.listing.update({
    where: { id },
    data: {
      verifiedAt: now,
      verifiedUntil: new Date(now.getTime() + TWELVE_MONTHS_MS),
      verifiedById: user.id,
    },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}

export async function unverifyListing(id: string): Promise<LifecycleResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  await prisma.listing.update({
    where: { id },
    data: {
      verifiedAt: null,
      verifiedUntil: null,
      verifiedById: null,
    },
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  return { ok: true };
}
