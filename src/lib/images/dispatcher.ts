import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/*
  Las queries pueden recibir un cliente Prisma opcional para correr
  dentro de una `$transaction`. Si no se pasa, usan el client global.
  El tipo acepta `PrismaClient` o `Prisma.TransactionClient` — ambos
  tienen el mismo shape de delegates (region, province, ...).
*/
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/*
  Dispatcher para imágenes asociadas a los 5 modelos editables. Espeja
  el patrón de `src/lib/translations/dispatcher.ts` — encapsula los
  delegates Prisma para que las server actions de imágenes trabajen
  contra una API uniforme por `entityType`.

  Diferencia clave vs translations: el "child model" no es el padre
  sino la tabla de imágenes (RegionImage, ProvinceImage, ...). Los 6
  helpers exportados cubren las operaciones que necesita
  `GalleryUploader`: listar, contar, crear, actualizar, borrar y leer
  el `code`/`id` del padre para construir el folder Cloudinary.
*/

export type EntityType =
  | "region"
  | "province"
  | "department"
  | "locality"
  | "listing";

/**
 * Shape uniforme que devuelven `findImageById` y `listImagesForEntity`.
 * Todos los image models tienen exactamente estos campos.
 */
export type ImageRow = {
  id: string;
  cloudinaryPublicId: string;
  url: string;
  caption: string | null;
  altText: string | null;
  order: number;
  isPrimary: boolean;
  createdAt: Date;
};

/*
  Límites editoriales por nivel — decisión cerrada en AGENTS.md y en
  v0.3-geo-a. Region/Province lleva más imágenes porque renderean
  hero + galería en la página pública; Department/Locality/Listing
  acotan para mantener cards/carruseles de tamaño razonable.
*/
export const IMAGE_LIMITS: Record<EntityType, number> = {
  region: 20,
  province: 15,
  department: 10,
  locality: 10,
  listing: 15,
};

/**
 * Lee una imagen por id + entityType, retornando además el `code` o
 * `id` del padre para construir paths (revalidate, Cloudinary folder).
 * Devuelve `null` si la imagen no existe.
 */
export async function findImageById(
  type: EntityType,
  imageId: string,
): Promise<
  | (ImageRow & {
      parentId: string;
      parentIdentifier: string;
    })
  | null
> {
  switch (type) {
    case "region": {
      const img = await prisma.regionImage.findUnique({
        where: { id: imageId },
        include: { region: { select: { id: true, code: true } } },
      });
      if (!img) return null;
      return {
        ...img,
        parentId: img.region.id,
        parentIdentifier: img.region.code,
      };
    }
    case "province": {
      const img = await prisma.provinceImage.findUnique({
        where: { id: imageId },
        include: { province: { select: { id: true, code: true } } },
      });
      if (!img) return null;
      return {
        ...img,
        parentId: img.province.id,
        parentIdentifier: img.province.code,
      };
    }
    case "department": {
      const img = await prisma.departmentImage.findUnique({
        where: { id: imageId },
        include: { department: { select: { id: true, code: true } } },
      });
      if (!img) return null;
      return {
        ...img,
        parentId: img.department.id,
        parentIdentifier: img.department.code,
      };
    }
    case "locality": {
      const img = await prisma.localityImage.findUnique({
        where: { id: imageId },
        include: { locality: { select: { id: true, code: true } } },
      });
      if (!img) return null;
      return {
        ...img,
        parentId: img.locality.id,
        parentIdentifier: img.locality.code,
      };
    }
    case "listing": {
      const img = await prisma.listingImage.findUnique({
        where: { id: imageId },
        include: { listing: { select: { id: true } } },
      });
      if (!img) return null;
      return {
        ...img,
        parentId: img.listing.id,
        // Listing usa `id` (cuid) como identifier — el `slug` es
        // editable y no estable para folders Cloudinary. Coherente con
        // la decisión del prompt v0.3-geo-c.
        parentIdentifier: img.listing.id,
      };
    }
  }
}

/**
 * Cuenta imágenes para un entity. Lo usamos para chequear `IMAGE_LIMITS`
 * antes de un upload nuevo.
 */
export async function countImages(
  type: EntityType,
  entityId: string,
  client: PrismaLike = prisma,
): Promise<number> {
  switch (type) {
    case "region":
      return client.regionImage.count({ where: { regionId: entityId } });
    case "province":
      return client.provinceImage.count({ where: { provinceId: entityId } });
    case "department":
      return client.departmentImage.count({
        where: { departmentId: entityId },
      });
    case "locality":
      return client.localityImage.count({ where: { localityId: entityId } });
    case "listing":
      return client.listingImage.count({ where: { listingId: entityId } });
  }
}

/**
 * Lee el `code` (geo) o `id` (Listing) del padre del entity. Sirve
 * para construir el folder Cloudinary y los paths de revalidate sin
 * que el caller tenga que conocer la estructura de cada modelo.
 *
 * Devuelve `null` si el entity no existe.
 */
export async function findEntityIdentifier(
  type: EntityType,
  entityId: string,
): Promise<string | null> {
  switch (type) {
    case "region": {
      const r = await prisma.region.findUnique({
        where: { id: entityId },
        select: { code: true },
      });
      return r?.code ?? null;
    }
    case "province": {
      const r = await prisma.province.findUnique({
        where: { id: entityId },
        select: { code: true },
      });
      return r?.code ?? null;
    }
    case "department": {
      const r = await prisma.department.findUnique({
        where: { id: entityId },
        select: { code: true },
      });
      return r?.code ?? null;
    }
    case "locality": {
      const r = await prisma.locality.findUnique({
        where: { id: entityId },
        select: { code: true },
      });
      return r?.code ?? null;
    }
    case "listing": {
      const r = await prisma.listing.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      return r?.id ?? null;
    }
  }
}

/**
 * Crea un row de imagen. El caller (server action) ya validó el
 * límite, hizo `requireRole`, y obtuvo metadata de Cloudinary. Acá
 * solo persistimos.
 *
 * `order` se calcula en el call site para soportar el "append al
 * final" sin un read extra acá. `isPrimary` también — la lógica de
 * "primera imagen = isPrimary true" vive en el server action porque
 * ahí ya conocemos el count.
 */
export async function createImage(
  type: EntityType,
  data: {
    entityId: string;
    cloudinaryPublicId: string;
    url: string;
    caption: string | null;
    altText: string | null;
    order: number;
    isPrimary: boolean;
  },
  client: PrismaLike = prisma,
): Promise<ImageRow> {
  const common = {
    cloudinaryPublicId: data.cloudinaryPublicId,
    url: data.url,
    caption: data.caption,
    altText: data.altText,
    order: data.order,
    isPrimary: data.isPrimary,
  };
  switch (type) {
    case "region":
      return client.regionImage.create({
        data: { ...common, regionId: data.entityId },
      });
    case "province":
      return client.provinceImage.create({
        data: { ...common, provinceId: data.entityId },
      });
    case "department":
      return client.departmentImage.create({
        data: { ...common, departmentId: data.entityId },
      });
    case "locality":
      return client.localityImage.create({
        data: { ...common, localityId: data.entityId },
      });
    case "listing":
      return client.listingImage.create({
        data: { ...common, listingId: data.entityId },
      });
  }
}

/**
 * Actualiza campos editables de una imagen (caption, altText). Order
 * e isPrimary tienen sus propios handlers porque requieren atomicidad
 * con el resto del entity.
 */
export async function updateImageFields(
  type: EntityType,
  imageId: string,
  data: { caption?: string | null; altText?: string | null },
): Promise<void> {
  switch (type) {
    case "region":
      await prisma.regionImage.update({ where: { id: imageId }, data });
      return;
    case "province":
      await prisma.provinceImage.update({ where: { id: imageId }, data });
      return;
    case "department":
      await prisma.departmentImage.update({ where: { id: imageId }, data });
      return;
    case "locality":
      await prisma.localityImage.update({ where: { id: imageId }, data });
      return;
    case "listing":
      await prisma.listingImage.update({ where: { id: imageId }, data });
      return;
  }
}

/**
 * Borra un row de imagen sin tocar Cloudinary. El caller (server
 * action) hace el delete del asset PRIMERO y solo invoca esto si
 * Cloudinary devolvió OK — así evita orphans en DB.
 *
 * Acepta un cliente Prisma opcional (default: `prisma`) para correr
 * dentro de transacciones (e.g. delete + auto-promote next primary).
 */
export async function deleteImageRow(
  type: EntityType,
  imageId: string,
  client: PrismaLike = prisma,
): Promise<void> {
  switch (type) {
    case "region":
      await client.regionImage.delete({ where: { id: imageId } });
      return;
    case "province":
      await client.provinceImage.delete({ where: { id: imageId } });
      return;
    case "department":
      await client.departmentImage.delete({ where: { id: imageId } });
      return;
    case "locality":
      await client.localityImage.delete({ where: { id: imageId } });
      return;
    case "listing":
      await client.listingImage.delete({ where: { id: imageId } });
      return;
  }
}

/**
 * Ejecuta una operación atómica para los dos casos donde necesitamos
 * un transaction wrapper típed (`setPrimary` y `reorder`): se le pasa
 * el `entityType` + un callback que recibe el `Prisma.TransactionClient`
 * + delegate correcto. La función decide cuál es el delegate a usar
 * — el caller solo se preocupa por la lógica de la operación.
 *
 * Mantiene el call site limpio: en vez de un switch repetido en cada
 * acción transaccional, se centraliza el dispatch.
 */
export async function runImageTransaction<T>(
  type: EntityType,
  fn: (
    tx: Prisma.TransactionClient,
    delegate: ImageDelegate,
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const delegate = getDelegate(type, tx);
    return fn(tx, delegate);
  });
}

/*
  El union `ImageDelegate` se queda corto en typing pero permite que
  los callers (setPrimary, reorder) hagan `delegate.updateMany({...})`
  con el shape común. Las diferencias por modelo (foreign key name,
  etc.) las maneja el caller via el `where`.
*/
export type ImageDelegate =
  | Prisma.TransactionClient["regionImage"]
  | Prisma.TransactionClient["provinceImage"]
  | Prisma.TransactionClient["departmentImage"]
  | Prisma.TransactionClient["localityImage"]
  | Prisma.TransactionClient["listingImage"];

function getDelegate(
  type: EntityType,
  tx: Prisma.TransactionClient,
): ImageDelegate {
  switch (type) {
    case "region":
      return tx.regionImage;
    case "province":
      return tx.provinceImage;
    case "department":
      return tx.departmentImage;
    case "locality":
      return tx.localityImage;
    case "listing":
      return tx.listingImage;
  }
}

/**
 * Nombre del campo FK para cada modelo de imagen — necesario para
 * los `where` de transacciones (setPrimary, reorder) cuando filtramos
 * por entity sin tener acceso directo al campo.
 */
export const FK_FIELD: Record<EntityType, string> = {
  region: "regionId",
  province: "provinceId",
  department: "departmentId",
  locality: "localityId",
  listing: "listingId",
};

/**
 * Lee el `order` máximo entre las imágenes del entity. Usado por el
 * create para que la nueva imagen vaya al final.
 */
export async function getMaxOrder(
  type: EntityType,
  entityId: string,
  client: PrismaLike = prisma,
): Promise<number> {
  switch (type) {
    case "region": {
      const r = await client.regionImage.aggregate({
        where: { regionId: entityId },
        _max: { order: true },
      });
      return r._max.order ?? -1;
    }
    case "province": {
      const r = await client.provinceImage.aggregate({
        where: { provinceId: entityId },
        _max: { order: true },
      });
      return r._max.order ?? -1;
    }
    case "department": {
      const r = await client.departmentImage.aggregate({
        where: { departmentId: entityId },
        _max: { order: true },
      });
      return r._max.order ?? -1;
    }
    case "locality": {
      const r = await client.localityImage.aggregate({
        where: { localityId: entityId },
        _max: { order: true },
      });
      return r._max.order ?? -1;
    }
    case "listing": {
      const r = await client.listingImage.aggregate({
        where: { listingId: entityId },
        _max: { order: true },
      });
      return r._max.order ?? -1;
    }
  }
}
