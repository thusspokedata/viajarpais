"use server";

import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  GeoEditorialContentSchema,
  type GeoEditorialContentInput,
} from "@/lib/geo/validation";
import {
  runAutoTranslation,
  type TranslationStatus,
} from "@/lib/translations/orchestrator";
import {
  getTranslationState,
  type EntityType,
  type TranslationState,
} from "@/lib/translations/dispatcher";
import { buildAllPaths } from "@/lib/public/buildAllPaths";

/*
  Server actions para editar contenido editorial geográfico. Una por
  nivel (region/province/department/locality) con la misma forma —
  cada una usa el delegate de Prisma correspondiente.

  Patrón compartido con `updateListing`:
  - `requireRole(["ADMIN", "EDITOR"])` defense in depth.
  - `expectedUpdatedAt` opcional → CAS optimistic lock dentro del WHERE
    del update. Si la fila cambió desde que el editor abrió el form,
    Prisma tira `P2025` y devolvemos `{ ok: false, conflict: true }`.
  - Solo se persisten campos `*Es` desde el form principal. Las
    traducciones EN/PT-BR las maneja `runAutoTranslation` después del
    UPDATE — dispara DeepL para los campos que efectivamente cambiaron,
    respetando el guard de source (MACHINE/NONE se regenera; REVIEWED/
    HUMAN se preserva con drift banner en UI).
  - Si DeepL falla o la cuota está agotada, el save en español sí se
    completa; los campos con falla quedan con `*PendingRetry=true` y el
    admin muestra banner naranja con botón de retry manual.
*/

export type UpdateGeoResult =
  | {
      ok: true;
      updatedAt: string;
      translationStatus: TranslationStatus;
    }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
      conflict?: true;
    };

type GeoLevel = "region" | "province" | "department" | "locality";

/*
  Revalidación post-mutación centralizada en `buildAllPaths`
  (`src/lib/public/buildAllPaths.ts`) — devuelve admin paths
  (lista + detail) y tags por nivel (`region:{code}`,
  `province:{slug}`, etc.). El helper resuelve la cadena de
  slugs con UN query Prisma.

  Antes del fix de C1, esta server action solo invalidaba paths
  admin via un map local — las paginas publicas quedaban staleas
  hasta el revalidate de 24h (deuda M-4 abierta). Ahora se cablea
  el helper con `revalidatePath` + `revalidateTag` consistente con
  el patron de `images/index.ts` y `translations/index.ts`.
*/

function flattenErrors(
  parsed: ReturnType<typeof GeoEditorialContentSchema.safeParse>,
) {
  if (parsed.success) return null;
  const flat = parsed.error.flatten();
  return {
    formErrors: flat.formErrors,
    fieldErrors: Object.fromEntries(
      Object.entries(flat.fieldErrors).filter(
        ([, v]) => Array.isArray(v) && v.length > 0,
      ),
    ) as Record<string, string[]>,
  };
}

function handleP2025orRethrow(err: unknown): UpdateGeoResult {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return {
      ok: false,
      conflict: true,
      message:
        "El contenido cambió desde la última vez que abriste esta página. Recargá para ver los cambios.",
    };
  }
  throw err;
}

/**
 * Helper compartido por los 4 updates geo. Hace la operación completa:
 *
 * 1. Lee el state previo (incluyendo todos los campos de traducción)
 *    DENTRO del CAS check — el `findUnique` extra es necesario porque
 *    el `update` con `expectedUpdatedAt` nos da solo el código y el
 *    nuevo updatedAt, pero necesitamos los `*Source` previos para
 *    decidir qué traducir.
 * 2. Hace el UPDATE de los `*Es` con CAS optimistic lock.
 * 3. Dispara `runAutoTranslation` que mira diff vs previousState y
 *    traduce solo los campos cambiados, respetando el guard de source.
 * 4. Revalidate de paths admin.
 */
async function performGeoUpdate(args: {
  level: GeoLevel;
  entityType: EntityType;
  id: string;
  data: GeoEditorialContentInput;
  expectedUpdatedAt: string | undefined;
  userId: string;
  runUpdate: (data: {
    where: { id: string; updatedAt?: Date };
    updateData: {
      taglineEs: string | null;
      descriptionEs: string | null;
      metaTitleEs: string | null;
      metaDescriptionEs: string | null;
      lastEditedById: string;
    };
  }) => Promise<{ updatedAt: Date; code: string }>;
}): Promise<UpdateGeoResult> {
  const {
    level,
    entityType,
    id,
    data,
    expectedUpdatedAt,
    userId,
    runUpdate,
  } = args;

  // Pre-read del state de traducción. Si el row no existe, el update
  // de Prisma va a tirar P2025 acá mismo o más abajo — manejo
  // uniforme.
  const previousState = await getTranslationState(entityType, id);
  if (!previousState) {
    return {
      ok: false,
      message: "El item ya no existe o fue movido.",
    };
  }

  let updated: { updatedAt: Date; code: string };
  try {
    updated = await runUpdate({
      where: {
        id,
        ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
      },
      updateData: {
        taglineEs: data.taglineEs ?? null,
        descriptionEs: data.descriptionEs ?? null,
        metaTitleEs: data.metaTitleEs ?? null,
        metaDescriptionEs: data.metaDescriptionEs ?? null,
        lastEditedById: userId,
      },
    });
  } catch (err) {
    return handleP2025orRethrow(err);
  }

  /*
    UPDATE OK — disparar traducción para los campos que cambiaron. Si
    DeepL falla, el save en español ya está commiteado: el editor ve
    el toast amarillo + banner naranja para reintentar. No lanzamos
    error para no rollback el español.

    XSS: tanto el input `data.descriptionEs`/`taglineEs` (ya
    persistido) como el output de DeepL que `runAutoTranslation` va a
    guardar se almacenan SIN sanitizar. Sanitización OBLIGATORIA en
    v0.4 antes de renderear como HTML público. Ver AGENTS.md →
    "Sanitización de Markdown del editor".
  */
  const translationStatus = await runAutoTranslation({
    type: entityType,
    id,
    previousState: previousState as TranslationState,
    nextValues: {
      taglineEs: data.taglineEs ?? null,
      descriptionEs: data.descriptionEs ?? null,
    },
  });

  // Invalidacion completa via helper centralizado: admin paths
  // (lista + detail) + tags geo del loader publico (`{level}:{slug}`).
  // Cierra deuda M-4 — los lectores publicos ven el cambio sin
  // esperar el revalidate ISR de 24h.
  //
  // updateTag (Next 16): variante simple para read-your-own-writes
  // desde un Server Action. Es el reemplazo del legacy revalidateTag
  // — mismo efecto, mejor naming.
  const { paths, tags } = await buildAllPaths(level, updated.code);
  paths.forEach((p) => revalidatePath(p));
  tags.forEach((t) => updateTag(t));

  return {
    ok: true,
    updatedAt: updated.updatedAt.toISOString(),
    translationStatus,
  };
}

export async function updateRegion(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);
  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) return { ok: false, ...errors };

  return performGeoUpdate({
    level: "region",
    entityType: "region",
    id,
    data: parsed.data,
    expectedUpdatedAt,
    userId: user.id,
    runUpdate: async ({ where, updateData }) =>
      prisma.region.update({
        where,
        data: updateData,
        select: { updatedAt: true, code: true },
      }),
  });
}

export async function updateProvince(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);
  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) return { ok: false, ...errors };

  return performGeoUpdate({
    level: "province",
    entityType: "province",
    id,
    data: parsed.data,
    expectedUpdatedAt,
    userId: user.id,
    runUpdate: async ({ where, updateData }) =>
      prisma.province.update({
        where,
        data: updateData,
        select: { updatedAt: true, code: true },
      }),
  });
}

export async function updateDepartment(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);
  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) return { ok: false, ...errors };

  return performGeoUpdate({
    level: "department",
    entityType: "department",
    id,
    data: parsed.data,
    expectedUpdatedAt,
    userId: user.id,
    runUpdate: async ({ where, updateData }) =>
      prisma.department.update({
        where,
        data: updateData,
        select: { updatedAt: true, code: true },
      }),
  });
}

export async function updateLocality(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);
  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) return { ok: false, ...errors };

  return performGeoUpdate({
    level: "locality",
    entityType: "locality",
    id,
    data: parsed.data,
    expectedUpdatedAt,
    userId: user.id,
    runUpdate: async ({ where, updateData }) =>
      prisma.locality.update({
        where,
        data: updateData,
        select: { updatedAt: true, code: true },
      }),
  });
}
