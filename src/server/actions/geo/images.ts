"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { deleteAsset } from "@/lib/cloudinary";

/*
  Server actions para imágenes geográficas en v0.3-geo-a.
  Lo mínimo necesario:
  - List: lo lee el page server-side, no hace falta server action.
  - Delete: cliente lo invoca con el ID de la imagen. Borra de DB y de
    Cloudinary (idempotente — `deleteAsset` no falla si el asset ya no
    existe).

  NO en este PR: upload, reorder, set-primary, edit caption. Todo eso
  llega en v0.3-geo-c con la UI de galería completa.

  Límites por nivel (validar en el upload action de v0.3-geo-c, NO al
  borrar):
  - RegionImage: max 20 por región.
  - ProvinceImage: max 15 por provincia.
  - DepartmentImage: max 10 por departamento.
  - LocalityImage: max 10 por localidad.
*/

export type DeleteImageResult =
  | { ok: true; alreadyDeletedFromCdn?: boolean }
  | { ok: false; message: string };

export async function deleteRegionImage(
  imageId: string,
): Promise<DeleteImageResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const img = await prisma.regionImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      cloudinaryPublicId: true,
      // `code` para revalidate (las paths son `/admin/geo/regions/[code]`,
      // no `[id]`).
      region: { select: { code: true } },
    },
  });
  if (!img) {
    return { ok: false, message: "La imagen no existe o ya fue eliminada." };
  }

  // Cloudinary primero — si falla, no borramos el row en DB. Asi una
  // imagen siempre tiene su asset matcheante (o no esta en DB en
  // absoluto). El asi-llamado "orphan" en CDN se evita.
  const cloud = await deleteAsset(img.cloudinaryPublicId);
  if (!cloud.ok) {
    return {
      ok: false,
      message:
        "No se pudo borrar la imagen del CDN. Reintentá en unos segundos.",
    };
  }

  try {
    await prisma.regionImage.delete({ where: { id: imageId } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      // Race: alguien la borró entre el findUnique y el delete. OK.
      return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
    }
    throw err;
  }

  revalidatePath(`/admin/geo/regions/${img.region.code}`);
  return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
}

export async function deleteProvinceImage(
  imageId: string,
): Promise<DeleteImageResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const img = await prisma.provinceImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      cloudinaryPublicId: true,
      province: { select: { code: true } },
    },
  });
  if (!img) {
    return { ok: false, message: "La imagen no existe o ya fue eliminada." };
  }

  const cloud = await deleteAsset(img.cloudinaryPublicId);
  if (!cloud.ok) {
    return {
      ok: false,
      message:
        "No se pudo borrar la imagen del CDN. Reintentá en unos segundos.",
    };
  }

  try {
    await prisma.provinceImage.delete({ where: { id: imageId } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
    }
    throw err;
  }

  revalidatePath(`/admin/geo/provinces/${img.province.code}`);
  return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
}

export async function deleteDepartmentImage(
  imageId: string,
): Promise<DeleteImageResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const img = await prisma.departmentImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      cloudinaryPublicId: true,
      department: { select: { code: true } },
    },
  });
  if (!img) {
    return { ok: false, message: "La imagen no existe o ya fue eliminada." };
  }

  const cloud = await deleteAsset(img.cloudinaryPublicId);
  if (!cloud.ok) {
    return {
      ok: false,
      message:
        "No se pudo borrar la imagen del CDN. Reintentá en unos segundos.",
    };
  }

  try {
    await prisma.departmentImage.delete({ where: { id: imageId } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
    }
    throw err;
  }

  revalidatePath(`/admin/geo/departments/${img.department.code}`);
  return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
}

export async function deleteLocalityImage(
  imageId: string,
): Promise<DeleteImageResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const img = await prisma.localityImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      cloudinaryPublicId: true,
      locality: { select: { code: true } },
    },
  });
  if (!img) {
    return { ok: false, message: "La imagen no existe o ya fue eliminada." };
  }

  const cloud = await deleteAsset(img.cloudinaryPublicId);
  if (!cloud.ok) {
    return {
      ok: false,
      message:
        "No se pudo borrar la imagen del CDN. Reintentá en unos segundos.",
    };
  }

  try {
    await prisma.localityImage.delete({ where: { id: imageId } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
    }
    throw err;
  }

  revalidatePath(`/admin/geo/localities/${img.locality.code}`);
  return { ok: true, alreadyDeletedFromCdn: cloud.alreadyDeleted };
}
