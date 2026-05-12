"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { v2 as cloudinaryApi } from "cloudinary";
import {
  deleteAsset,
  getCloudName,
  getUploadSignature as getCloudinarySignature,
  type UploadSignatureResult,
} from "@/lib/cloudinary";
import {
  countImages,
  createImage,
  deleteImageRow,
  findEntityIdentifier,
  findImageById,
  FK_FIELD,
  getMaxOrder,
  IMAGE_LIMITS,
  runImageTransaction,
  updateImageFields,
  type EntityType,
  type ImageRow,
} from "@/lib/images/dispatcher";

/*
  Server actions de la galería para los 5 modelos con imágenes
  (Region, Province, Department, Locality, Listing). 6 verbos:

  - `getUploadSignature`: el cliente pide signature firmada antes del
    upload directo a Cloudinary. Folder se arma con identifier estable
    (code para geo, id cuid para Listings — slug es editable).
  - `saveImageMetadata`: después del upload OK, el cliente persiste
    el row en DB. Acá chequeamos límite por nivel y auto-primary
    para la primera imagen.
  - `updateImage`: caption + altText.
  - `setImageAsPrimary`: transacción que baja isPrimary en todas las
    hermanas y la sube en la elegida.
  - `reorderImages`: array de IDs en orden nuevo → UPDATE atómico.
  - `deleteImage`: borra Cloudinary PRIMERO, después DB. Idempotente
    (deleteAsset trata "not found" como ok).

  Todas validan input con zod + `requireRole(["ADMIN", "EDITOR"])`.
  Revalidate de paths apunta a la página admin del entity para que
  el grid se refresque sin reload manual.
*/

const ENTITY_TYPE_VALUES = [
  "region",
  "province",
  "department",
  "locality",
  "listing",
] as const satisfies readonly EntityType[];

const EntityTypeEnum = z.enum(ENTITY_TYPE_VALUES);

/**
 * Construye las paths admin a revalidate después de cualquier mutación
 * de imágenes. Cada entity tiene su propia ruta de edición.
 */
function buildAdminPaths(type: EntityType, identifier: string): string[] {
  switch (type) {
    case "region":
      return [`/admin/geo/regions/${identifier}`];
    case "province":
      return [`/admin/geo/provinces/${identifier}`];
    case "department":
      return [`/admin/geo/departments/${identifier}`];
    case "locality":
      return [`/admin/geo/localities/${identifier}`];
    case "listing":
      return [`/admin/listings/${identifier}`];
  }
}

export type ImagesActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "INVALID_NONCE"
        | "ASSET_NOT_FOUND"
        | "ENTITY_NOT_FOUND"
        | "IMAGE_NOT_FOUND"
        | "MAX_IMAGES_REACHED"
        | "CLOUDINARY_FAILED"
        | "UPLOAD_CONFIG_MISSING"
        | "PRIMARY_CONFLICT"
        | "CONFLICT_RETRY"
        | "UNKNOWN";
      message: string;
    };

// ============================================================
// 1. getUploadSignature
// ============================================================

const SignaturePayloadSchema = z.object({
  entityType: EntityTypeEnum,
  entityId: z.string().min(1),
});

export type GetUploadSignatureResult = ImagesActionResult<UploadSignatureResult>;

/**
 * El cliente solicita esto ANTES de hacer upload a Cloudinary. Resuelve
 * el identifier estable del entity para construir el folder
 * (regions/{code}, listings/{id}, etc.) + genera un nonce single-use
 * que persiste en `UploadSignatureNonce` y firma como parte del
 * payload Cloudinary. La signature solo es válida ~1h desde su
 * timestamp (el preset Cloudinary también enforce `timestamp_validity
 * = 120s` server-side de su lado).
 *
 * H-1 fix (CodeRabbit + audit interno): sin nonce, una signature
 * cacheada permite N uploads al folder firmado durante la ventana de
 * validez → drain del Free plan 25GB. Con nonce, cada signature solo
 * puede registrar UN row en `saveImageMetadata`. Para subir N veces
 * el cliente tiene que pedir N signatures distintas (cada una con
 * su propio nonce + entry en DB).
 *
 * Si el entity no existe, devolvemos error temprano antes de generar
 * el nonce (evita basura en DB para folders fantasma).
 */
export async function getUploadSignature(
  raw: z.infer<typeof SignaturePayloadSchema>,
): Promise<GetUploadSignatureResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const parsed = SignaturePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const { entityType, entityId } = parsed.data;

  const identifier = await findEntityIdentifier(entityType, entityId);
  if (!identifier) {
    return {
      ok: false,
      code: "ENTITY_NOT_FOUND",
      message: "El item no existe.",
    };
  }

  const folder = `${entityFolderPrefix(entityType)}/${identifier}`;

  // Generar y persistir el nonce ANTES de firmar. Si la creación
  // falla (e.g. DB unavailable), abortamos sin retornar signature
  // — mejor que firmar y no poder validar después.
  const nonce = crypto.randomUUID();
  try {
    await prisma.uploadSignatureNonce.create({
      data: { nonce, entityType, entityId },
    });
  } catch (err) {
    console.error("[images.getUploadSignature] nonce persist failed", err);
    return {
      ok: false,
      code: "UNKNOWN",
      message: "No se pudo preparar el upload. Probá de nuevo.",
    };
  }

  try {
    const signature = await getCloudinarySignature(folder, nonce);
    return { ok: true, data: signature };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("CLOUDINARY_UPLOAD_PRESET")) {
      return {
        ok: false,
        code: "UPLOAD_CONFIG_MISSING",
        message:
          "Configuración de upload incompleta, contactá al administrador.",
      };
    }
    console.error("[images.getUploadSignature]", err);
    return {
      ok: false,
      code: "UNKNOWN",
      message: "No se pudo preparar el upload. Probá de nuevo.",
    };
  }
}

function entityFolderPrefix(type: EntityType): string {
  switch (type) {
    case "region":
      return "regions";
    case "province":
      return "provinces";
    case "department":
      return "departments";
    case "locality":
      return "localities";
    case "listing":
      return "listings";
  }
}

// ============================================================
// 2. saveImageMetadata
// ============================================================

/*
  El cliente NO controla la `url` final. Solo recibe del flujo Cloudinary
  un `secure_url` que CodeRabbit/security audit señaló como vector de
  injection (cliente malicioso podría persistir `https://attacker.com/...`).
  El server re-deriva la URL desde `cloudinaryPublicId` con `cloudinaryUrl`
  → la columna `url` siempre apunta a nuestra cuenta Cloudinary. La
  variant "original" preserva el master sin transformación.

  `caption` y `altText` quedan opcionales acá por compatibilidad pero el
  cliente actual NO los manda en el primer save — el editor los setea
  después con `updateImage`. La default es null en ambos casos.
*/
const SaveMetadataPayloadSchema = z.object({
  entityType: EntityTypeEnum,
  entityId: z.string().min(1),
  cloudinaryPublicId: z.string().min(1),
  /**
   * Nonce single-use que el cliente recibió de `getUploadSignature`.
   * El server lo marca como `usedAt = now()` atómicamente para
   * impedir reuso. Sin esto, una signature cacheada permitía N
   * uploads con el plan Free (drain de 25GB).
   */
  nonce: z.string().uuid(),
  caption: z.string().max(200).optional(),
  altText: z.string().max(200).optional(),
});

export type SaveImageMetadataResult = ImagesActionResult<ImageRow>;

/**
 * Persiste el row de imagen en DB después de un upload exitoso a
 * Cloudinary. El cliente llama a esto en el paso 5 del flujo.
 *
 * Reglas + defensas (todas dentro de una transacción Serializable):
 *
 * 1. Validar que `cloudinaryPublicId` empiece con el prefix esperado
 *    `{entityFolderPrefix}/{identifier}/`. Sin esto, un editor podría
 *    registrar como propia una imagen del folder de otra entidad
 *    (cross-mount) o de otro entityType (cross-type). HIGH security
 *    vector cerrado.
 *
 * 2. Re-derivar `url` server-side desde el `publicId` con
 *    `cloudinaryUrl(publicId, "original")`. El cliente NO controla
 *    la URL final — antes, `z.string().url()` aceptaba cualquier URL
 *    (incluyendo dominios externos del atacante). Vector de URL
 *    injection cerrado.
 *
 * 3. Chequear `IMAGE_LIMITS` por nivel. Si excede, retornar
 *    `MAX_IMAGES_REACHED` sin crear el row (la imagen queda en
 *    Cloudinary como orphan — el cleanup job futuro la barrerá).
 *
 * 4. La PRIMERA imagen del entity se marca automáticamente como
 *    `isPrimary = true`. El order arranca en 0 (max + 1, donde max
 *    inicial = -1). El resto va con `isPrimary = false`.
 *
 * 5. La transacción usa `isolationLevel: Serializable` para que el
 *    chequeo de `currentCount` + `getMaxOrder` + `createImage` sea
 *    atómico. Dos uploads concurrentes en un entity vacío no pueden
 *    ambos pasar `currentCount === 0` — Postgres serializa y uno
 *    pierde con `P2034 Serialization`. Adicionalmente, el partial
 *    unique constraint `WHERE isPrimary = true` (migración
 *    `20260511150000_add_partial_unique_constraints_for_image_primary`)
 *    cierra el caso definitivamente: aún sin serialización, el
 *    segundo intento de `isPrimary=true` falla con `P2002`.
 *
 * Retry: el caller (cliente) maneja los códigos de error explícitos
 * y muestra mensaje claro al editor. No reintentamos automáticamente
 * acá — el cliente decide en función del tipo de fallo.
 */
export async function saveImageMetadata(
  raw: z.infer<typeof SaveMetadataPayloadSchema>,
): Promise<SaveImageMetadataResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = SaveMetadataPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const data = parsed.data;

  const identifier = await findEntityIdentifier(data.entityType, data.entityId);
  if (!identifier) {
    return {
      ok: false,
      code: "ENTITY_NOT_FOUND",
      message: "El item al que pertenece la imagen ya no existe.",
    };
  }

  // 1. Validación de prefix — el publicId debe pertenecer al folder
  //    firmado para este entityType + entityId.
  const expectedPrefix = `${entityFolderPrefix(data.entityType)}/${identifier}/`;
  if (!data.cloudinaryPublicId.startsWith(expectedPrefix)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "El publicId de la imagen no pertenece a este item.",
    };
  }

  /*
    1.5. Consumir nonce single-use (H-1 fix). Update condicional
    `WHERE usedAt IS NULL` con check del entityType+entityId. Si dos
    requests llegan con el mismo nonce, solo uno gana — el otro recibe
    `count === 0` y devolvemos `INVALID_NONCE`. Cubre también:
    - Nonce inexistente (típico de cliente manipulado).
    - Nonce de otra entity (replay attack cross-entity).
    - Nonce ya usado (replay attack a la misma entity).
  */
  const claim = await prisma.uploadSignatureNonce.updateMany({
    where: {
      nonce: data.nonce,
      usedAt: null,
      entityType: data.entityType,
      entityId: data.entityId,
    },
    data: { usedAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      code: "INVALID_NONCE",
      message:
        "El nonce de upload es inválido o ya fue usado. Reintentá la subida.",
    };
  }

  // 2. Re-derivar URL server-side. NO confiamos en el cliente.
  const cloudName = getCloudName();
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/${data.cloudinaryPublicId}`;

  /*
    2.5. M-3 fix: verificar que el asset realmente exista en
    Cloudinary. Sin esto, un cliente malicioso podía registrar
    `cloudinaryPublicId="regions/cuyo/voidasset123"` sin haber subido
    nada — el row quedaba con URL apuntando a 404. Llamamos
    `cloudinary.api.resource()` que devuelve metadata real si existe;
    si no, lanza error que mapeamos a `ASSET_NOT_FOUND`.

    No persistimos el `width/height/bytes/format` retornados porque
    el schema actual no los tiene — podría ser un follow-up útil
    (para validar tamaños o pre-construir `next/image` con
    dimensions exactas), documentado en backlog si vale.
  */
  try {
    await cloudinaryApi.api.resource(data.cloudinaryPublicId, {
      resource_type: "image",
    });
  } catch (err) {
    console.error("[saveImageMetadata] Cloudinary asset not found", {
      publicId: data.cloudinaryPublicId,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: "ASSET_NOT_FOUND",
      message: "La imagen no existe en Cloudinary. Reintentá la subida.",
    };
  }

  // 3-5. Limite + auto-primary dentro de transacción Serializable.
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const currentCount = await countImages(
          data.entityType,
          data.entityId,
          tx,
        );
        const max = IMAGE_LIMITS[data.entityType];
        if (currentCount >= max) {
          throw new MaxImagesReachedError(max);
        }
        const maxOrder = await getMaxOrder(
          data.entityType,
          data.entityId,
          tx,
        );
        return createImage(
          data.entityType,
          {
            entityId: data.entityId,
            cloudinaryPublicId: data.cloudinaryPublicId,
            url,
            caption: data.caption ?? null,
            altText: data.altText ?? null,
            order: maxOrder + 1,
            isPrimary: currentCount === 0,
          },
          tx,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 3_000,
        timeout: 5_000,
      },
    );

    buildAdminPaths(data.entityType, identifier).forEach((p) =>
      revalidatePath(p),
    );
    logImageAction({
      action: "saveImageMetadata",
      actorId: user.id,
      imageId: created.id,
      entityType: data.entityType,
      entityId: data.entityId,
    });
    return { ok: true, data: created };
  } catch (err) {
    if (err instanceof MaxImagesReachedError) {
      return {
        ok: false,
        code: "MAX_IMAGES_REACHED",
        message: `Máximo ${err.max} imágenes para este nivel.`,
      };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = partial unique conflict (otro request ya marcó
      // isPrimary=true). Race detectada y rechazada por DB.
      if (err.code === "P2002") {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message:
            "Conflicto al guardar la imagen primary. Reintentá en unos segundos.",
        };
      }
      // P2034 = serialization failure (otra tx ganó el race en
      // Serializable). El cliente puede reintentar.
      if (err.code === "P2034") {
        return {
          ok: false,
          code: "UNKNOWN",
          message: "Conflicto temporal al guardar. Reintentá.",
        };
      }
    }
    throw err;
  }
}

class MaxImagesReachedError extends Error {
  constructor(public readonly max: number) {
    super(`MAX_IMAGES_REACHED:${max}`);
  }
}

// ============================================================
// 3. updateImage
// ============================================================

const UpdateImagePayloadSchema = z.object({
  imageId: z.string().min(1),
  entityType: EntityTypeEnum,
  caption: z.string().max(200).nullable().optional(),
  altText: z.string().max(200).nullable().optional(),
});

export async function updateImage(
  raw: z.infer<typeof UpdateImagePayloadSchema>,
): Promise<ImagesActionResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = UpdateImagePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const { imageId, entityType, caption, altText } = parsed.data;

  if (caption === undefined && altText === undefined) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "No hay cambios para guardar.",
    };
  }

  const img = await findImageById(entityType, imageId);
  if (!img) {
    return {
      ok: false,
      code: "IMAGE_NOT_FOUND",
      message: "La imagen ya no existe.",
    };
  }

  await updateImageFields(entityType, imageId, {
    ...(caption !== undefined ? { caption } : {}),
    ...(altText !== undefined ? { altText } : {}),
  });

  buildAdminPaths(entityType, img.parentIdentifier).forEach((p) =>
    revalidatePath(p),
  );
  logImageAction({
    action: "updateImage",
    actorId: user.id,
    imageId,
    entityType,
    entityId: img.parentId,
  });
  return { ok: true };
}

// ============================================================
// 4. setImageAsPrimary
// ============================================================

const SetPrimaryPayloadSchema = z.object({
  imageId: z.string().min(1),
  entityType: EntityTypeEnum,
});

/**
 * Marca una imagen como primary. Transacción atómica:
 *
 *   1. Baja `isPrimary` en TODAS las hermanas del mismo entity.
 *   2. Sube `isPrimary` en la imagen elegida.
 *
 * Sin transacción, podría quedar un instante con 0 ó 2 primaries
 * visibles para queries concurrentes. El schema NO tiene partial
 * unique constraint en isPrimary (decisión cerrada — la atomicidad
 * vive en el server action), así que la transacción es la única
 * garantía.
 */
export async function setImageAsPrimary(
  raw: z.infer<typeof SetPrimaryPayloadSchema>,
): Promise<ImagesActionResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = SetPrimaryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const { imageId, entityType } = parsed.data;

  const img = await findImageById(entityType, imageId);
  if (!img) {
    return {
      ok: false,
      code: "IMAGE_NOT_FOUND",
      message: "La imagen ya no existe.",
    };
  }

  /*
    CR#6 + M-A fix: catch Prisma errors específicos que pueden surgir
    de la transacción cuando hay concurrencia con otros editores:
    - P2025 (record not found): la imagen se borró entre `findImageById`
      y el update dentro de la tx → race con `deleteImage`.
    - P2002 (unique constraint): otra request ganó la carrera del
      partial unique `WHERE isPrimary = true` → otro editor marcó
      otra imagen como primary en paralelo.
    - P2034 (serialization failure): isolation conflict bajo
      Serializable → reintento esperado del cliente.
  */
  try {
    await runImageTransaction(entityType, async (_tx, delegate) => {
      const where = { [FK_FIELD[entityType]]: img.parentId };
      // @ts-expect-error — el union de delegates no permite inferir
      // el tipo exacto del where; runtime acepta `{ [fk]: string }`.
      await delegate.updateMany({
        where,
        data: { isPrimary: false },
      });
      // @ts-expect-error — mismo motivo que arriba.
      await delegate.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return {
          ok: false,
          code: "IMAGE_NOT_FOUND",
          message: "La imagen ya no existe.",
        };
      }
      if (err.code === "P2002") {
        return {
          ok: false,
          code: "PRIMARY_CONFLICT",
          message:
            "Otra imagen ya fue marcada como principal. Refrescá e intentá de nuevo.",
        };
      }
      if (err.code === "P2034") {
        return {
          ok: false,
          code: "CONFLICT_RETRY",
          message: "Conflicto temporal. Intentá de nuevo.",
        };
      }
    }
    throw err;
  }

  buildAdminPaths(entityType, img.parentIdentifier).forEach((p) =>
    revalidatePath(p),
  );
  logImageAction({
    action: "setImageAsPrimary",
    actorId: user.id,
    imageId,
    entityType,
    entityId: img.parentId,
  });
  return { ok: true };
}

// ============================================================
// 5. reorderImages
// ============================================================

const ReorderPayloadSchema = z.object({
  entityType: EntityTypeEnum,
  entityId: z.string().min(1),
  orderedImageIds: z.array(z.string().min(1)).min(1),
});

/**
 * Reordena imágenes según el array recibido. Transacción atómica que
 * UPDATEa cada row con su nuevo `order` (índice en el array).
 *
 * Defensa: validamos que todos los IDs pertenecen al mismo entity
 * antes de tocar nada — caller malicioso no puede inyectar IDs de
 * otra entity para mezclar órdenes.
 */
export async function reorderImages(
  raw: z.infer<typeof ReorderPayloadSchema>,
): Promise<ImagesActionResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = ReorderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const { entityType, entityId, orderedImageIds } = parsed.data;

  const identifier = await findEntityIdentifier(entityType, entityId);
  if (!identifier) {
    return {
      ok: false,
      code: "ENTITY_NOT_FOUND",
      message: "El item ya no existe.",
    };
  }

  try {
    await runImageTransaction(entityType, async (_tx, delegate) => {
      /*
        Validamos que el payload sea EXACTAMENTE el set de imágenes
        del entity. Antes solo validábamos "todos los IDs pertenecen
        al entity" — pero un subset (e.g. mandar 2 de 4 imágenes
        existentes) generaba órdenes duplicados/no-monotónicos en DB
        cuando los IDs no incluidos retenían su orden viejo. CodeRabbit
        + data audit lo identificaron como Major.

        Implementación: leemos TODOS los IDs del entity y comparamos
        cardinalidad + equality con el payload via Set. Si el cliente
        agrega un ID extraño (no pertenece) o omite uno (subset), la
        tx aborta sin tocar nada.
      */
      const where = { [FK_FIELD[entityType]]: entityId };
      // @ts-expect-error — ver explicación en setImageAsPrimary.
      const existing = await delegate.findMany({
        where,
        select: { id: true },
      });
      const existingIds = new Set<string>(
        (existing as { id: string }[]).map((r) => r.id),
      );
      const incomingIds = new Set<string>(orderedImageIds);

      if (existingIds.size !== incomingIds.size) {
        throw new InvalidReorderError(
          "El payload no contiene exactamente todas las imágenes del item.",
        );
      }
      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          throw new InvalidReorderError(
            "El payload no contiene exactamente todas las imágenes del item.",
          );
        }
      }
      // Defensa adicional contra duplicados en el payload del cliente:
      // si `orderedImageIds.length !== incomingIds.size`, hay un id
      // repetido — entonces existingIds.size === incomingIds.size pero
      // el array tiene más entries. Sin este check, el for loop
      // setearia `order` repetido a la misma id.
      if (orderedImageIds.length !== incomingIds.size) {
        throw new InvalidReorderError(
          "El payload tiene IDs duplicados.",
        );
      }

      // UPDATEs serializados dentro de la tx. Prisma no expone bulk
      // update con valores distintos por row — uno por iteración.
      // Para 5-20 imágenes (límites del proyecto) es trivial.
      for (let i = 0; i < orderedImageIds.length; i++) {
        // @ts-expect-error — ver explicación en setImageAsPrimary.
        await delegate.update({
          where: { id: orderedImageIds[i] },
          data: { order: i },
        });
      }
    });
  } catch (err) {
    if (err instanceof InvalidReorderError) {
      return { ok: false, code: "INVALID_INPUT", message: err.message };
    }
    /*
      CR#6 + M-A: misma defensa de P2025/P2034 en `reorderImages` que
      en `setImageAsPrimary`. Race con `deleteImage` puede tirar
      P2025 si una imagen del set se borró durante la tx; P2034 si
      el isolation level escala el conflict.
    */
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return {
          ok: false,
          code: "IMAGE_NOT_FOUND",
          message:
            "Una imagen del set ya no existe. Refrescá la galería.",
        };
      }
      if (err.code === "P2034") {
        return {
          ok: false,
          code: "CONFLICT_RETRY",
          message: "Conflicto temporal. Intentá de nuevo.",
        };
      }
    }
    throw err;
  }

  buildAdminPaths(entityType, identifier).forEach((p) => revalidatePath(p));
  logImageAction({
    action: "reorderImages",
    actorId: user.id,
    imageId: null,
    entityType,
    entityId,
    extra: { count: orderedImageIds.length },
  });
  return { ok: true };
}

class InvalidReorderError extends Error {}

// ============================================================
// 6. deleteImage
// ============================================================

const DeleteImagePayloadSchema = z.object({
  imageId: z.string().min(1),
  entityType: EntityTypeEnum,
});

/**
 * Borra una imagen end-to-end. Orden:
 *
 *   1. Cloudinary destroy.
 *   2. Si Cloudinary OK (incluyendo "not found"), borrar row de DB.
 *   3. Si la imagen borrada era `isPrimary=true`, auto-promover la
 *      siguiente (menor `order`) como nueva primary. Sin esto, el
 *      entity quedaba con 0 primaries silenciosamente — el frontend
 *      público (que asume `findFirst({ isPrimary: true })`) rendería
 *      null.
 *
 * Si Cloudinary falla, NO borramos el row — preferimos un orphan
 * inverso (row sin asset) que el contrario, porque el asset huérfano
 * en Cloudinary cuesta storage y el row sin asset queda visible al
 * editor como imagen rota → puede reintentar.
 *
 * Idempotente: `deleteAsset` trata "not found" como ok, y un P2025
 * en el delete del row también es ok (race: alguien más borró entre
 * findImageById y deleteImageRow).
 *
 * Log estructurado cuando Cloudinary OK pero DB falla con error
 * NO-P2025 (deadlock, conexión muerta, etc.): el row sobrevive
 * apuntando a un asset borrado — imagen rota en el grid. AGENTS.md
 * documenta esto como gap conocido + plan de cleanup job futuro.
 */
export async function deleteImage(
  raw: z.infer<typeof DeleteImagePayloadSchema>,
): Promise<ImagesActionResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = DeleteImagePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", message: "Parámetros inválidos." };
  }
  const { imageId, entityType } = parsed.data;

  const img = await findImageById(entityType, imageId);
  if (!img) {
    return {
      ok: false,
      code: "IMAGE_NOT_FOUND",
      message: "La imagen ya no existe.",
    };
  }

  const cloud = await deleteAsset(img.cloudinaryPublicId);
  if (!cloud.ok) {
    return {
      ok: false,
      code: "CLOUDINARY_FAILED",
      message:
        "No se pudo borrar la imagen del CDN. Reintentá en unos segundos.",
    };
  }

  /*
    Transacción atómica: delete + auto-promote next primary. Si el
    delete falla, el promote no corre. Si el delete OK + promote
    fails, la tx se rolea y el row sobrevive (la imagen vuelve a
    aparecer en el grid; editor reintenta).

    Excepción: si la tx falla con un error no-P2025 después de que
    Cloudinary ya borró exitosamente, el rollback DEL row deja al
    editor con una imagen rota apuntando a un asset borrado. Por eso
    el log estructurado abajo — el cleanup job futuro lo identifica.
  */
  try {
    await prisma.$transaction(async (tx) => {
      await deleteImageRow(entityType, imageId, tx);

      if (img.isPrimary) {
        await promoteNextPrimary(entityType, img.parentId, tx);
      }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      // Race: alguien la borró entre el findImageById y el delete. OK.
      // Auto-promote ya no aplica porque hubo otro delete que probablemente
      // hizo su propio promote.
    } else {
      // M3: log estructurado para cleanup manual / job futuro.
      // Cloudinary YA borró el asset; DB row sobrevive con publicId
      // apuntando a void. Documentado en AGENTS.md.
      console.error("[deleteImage] DB delete failed after Cloudinary OK", {
        imageId,
        cloudinaryPublicId: img.cloudinaryPublicId,
        entityType,
        entityId: img.parentId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw: el caller recibe el error real, el editor puede
      // reintentar. El reintento va a re-encontrar el row y volver
      // a invocar `deleteAsset` (idempotente, devuelve "not found" OK).
      throw err;
    }
  }

  buildAdminPaths(entityType, img.parentIdentifier).forEach((p) =>
    revalidatePath(p),
  );
  logImageAction({
    action: "deleteImage",
    actorId: user.id,
    imageId,
    entityType,
    entityId: img.parentId,
    extra: { wasPrimary: img.isPrimary },
  });
  return { ok: true };
}

/**
 * Promueve la siguiente imagen del entity como `isPrimary=true`. La
 * elegida es la de menor `order` (la "primera" visualmente). Si no
 * queda ninguna imagen, no hace nada — el entity simplemente queda
 * sin primary.
 *
 * Se llama desde `deleteImage` solo cuando se borra la imagen
 * primary actual. Corre dentro de la misma transacción del delete,
 * así que si falla, el delete entero se rolea.
 *
 * Idempotente vs partial unique: el delete ya removió el row con
 * `isPrimary=true`, así que el SET nuevo no conflicta con el partial
 * unique constraint.
 */
async function promoteNextPrimary(
  type: EntityType,
  parentId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  switch (type) {
    case "region": {
      const next = await tx.regionImage.findFirst({
        where: { regionId: parentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.regionImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
      return;
    }
    case "province": {
      const next = await tx.provinceImage.findFirst({
        where: { provinceId: parentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.provinceImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
      return;
    }
    case "department": {
      const next = await tx.departmentImage.findFirst({
        where: { departmentId: parentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.departmentImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
      return;
    }
    case "locality": {
      const next = await tx.localityImage.findFirst({
        where: { localityId: parentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.localityImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
      return;
    }
    case "listing": {
      const next = await tx.listingImage.findFirst({
        where: { listingId: parentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.listingImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
      return;
    }
  }
}

/**
 * Log estructurado para auditoría de mutaciones de imágenes — closure
 * de la deuda L-1 documentada en AGENTS.md hasta este PR.
 *
 * Diseño:
 * - Mismo shape en las 5 server actions mutadoras (`saveImageMetadata`,
 *   `updateImage`, `setImageAsPrimary`, `reorderImages`, `deleteImage`)
 *   para que el log sea parseable con `grep` o herramientas estilo
 *   logfmt/JSON.
 * - Prefijo `[image-action]` único para filtrar en Vercel logs.
 * - `imageId` es `null` cuando la acción aplica a un set (reorder).
 * - `extra` opcional para metadata específica por acción (e.g.
 *   `wasPrimary` en delete, `count` en reorder).
 * - `result: "success"` fijo — los failure paths ya logean su propio
 *   error context con `console.error` en los catches; este helper
 *   solo cubre el success path para trazabilidad operacional.
 *
 * En el plan Free de Vercel los logs persisten 30 días. Long-term
 * (cuando >1 editor en simultáneo justifique investigaciones de
 * incidentes), agregar tabla `AuditLog` consultable desde admin —
 * documentado en AGENTS.md como deuda futura aparte.
 */
function logImageAction(args: {
  action:
    | "saveImageMetadata"
    | "updateImage"
    | "setImageAsPrimary"
    | "reorderImages"
    | "deleteImage";
  actorId: string;
  imageId: string | null;
  entityType: EntityType;
  entityId: string;
  extra?: Record<string, unknown>;
}): void {
  console.info("[image-action]", {
    action: args.action,
    actor: args.actorId,
    imageId: args.imageId,
    entityType: args.entityType,
    entityId: args.entityId,
    result: "success",
    timestamp: new Date().toISOString(),
    ...args.extra,
  });
}
