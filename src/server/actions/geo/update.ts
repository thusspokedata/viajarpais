"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  GeoEditorialContentSchema,
  type GeoEditorialContentInput,
} from "@/lib/geo/validation";

/*
  Server actions para editar contenido editorial geográfico. Una por
  nivel (region/province/department/locality) con la misma forma —
  cada una usa el delegate de Prisma correspondiente.

  Patrón compartido con `updateListing`:
  - `requireRole(["ADMIN", "EDITOR"])` defense in depth.
  - `expectedUpdatedAt` opcional → CAS optimistic lock dentro del WHERE
    del update. Si la fila cambió desde que el editor abrió el form,
    Prisma tira `P2025` y devolvemos `{ ok: false, conflict: true }`.
  - Solo se persisten campos `*Es`. Source/translatedAt/En/PtBr quedan
    intactos — DeepL los toca en v0.3-geo-b.
*/

export type UpdateGeoResult =
  | { ok: true; updatedAt: string }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
      conflict?: true;
    };

type GeoLevel = "region" | "province" | "department" | "locality";

/*
  Las paths de edición geo se rutean por `[code]` (Georef ID), NO por
  `id` (cuid). El `revalidatePath` tiene que pasar `code` o el cache RSC
  no matchea y queda staleado. La server action recibe `id` del caller
  pero resuelve el `code` con `select` adicional en el `update` (sin
  query extra — viene en la misma row del UPDATE).

  `/admin/geo/regions` y similares NO son rutas (no hay
  `/regions/page.tsx`, solo `/regions/[code]/page.tsx`), así que las
  saco del array — el revalidate sería no-op.
*/
const REVALIDATE_PATHS: Record<GeoLevel, (code: string) => string[]> = {
  region: (code) => ["/admin/geo", `/admin/geo/regions/${code}`],
  province: (code) => [
    "/admin/geo/provinces",
    `/admin/geo/provinces/${code}`,
  ],
  department: (code) => [
    "/admin/geo/departments",
    `/admin/geo/departments/${code}`,
  ],
  locality: (code) => [
    "/admin/geo/localities",
    `/admin/geo/localities/${code}`,
  ],
};

function flattenErrors(parsed: ReturnType<typeof GeoEditorialContentSchema.safeParse>) {
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

/*
  Cada delegate recibe la misma forma de data; tipear `Prisma.<Level>UpdateInput`
  caso por caso fuerza al typecheck a quejarse si algún campo del schema
  diverge entre niveles, lo que es una guard automática.
*/

export async function updateRegion(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) {
    return { ok: false, ...errors };
  }
  const data = parsed.data;

  try {
    const updated = await prisma.region.update({
      where: {
        id,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : {}),
      },
      data: {
        taglineEs: data.taglineEs ?? null,
        descriptionEs: data.descriptionEs ?? null,
        metaTitleEs: data.metaTitleEs ?? null,
        metaDescriptionEs: data.metaDescriptionEs ?? null,
        lastEditedById: user.id,
      },
      select: { updatedAt: true, code: true },
    });
    REVALIDATE_PATHS.region(updated.code).forEach((p) => revalidatePath(p));
    return { ok: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (err) {
    return handleP2025orRethrow(err);
  }
}

export async function updateProvince(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) {
    return { ok: false, ...errors };
  }
  const data = parsed.data;

  try {
    const updated = await prisma.province.update({
      where: {
        id,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : {}),
      },
      data: {
        taglineEs: data.taglineEs ?? null,
        descriptionEs: data.descriptionEs ?? null,
        metaTitleEs: data.metaTitleEs ?? null,
        metaDescriptionEs: data.metaDescriptionEs ?? null,
        lastEditedById: user.id,
      },
      select: { updatedAt: true, code: true },
    });
    REVALIDATE_PATHS.province(updated.code).forEach((p) => revalidatePath(p));
    return { ok: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (err) {
    return handleP2025orRethrow(err);
  }
}

export async function updateDepartment(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) {
    return { ok: false, ...errors };
  }
  const data = parsed.data;

  try {
    const updated = await prisma.department.update({
      where: {
        id,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : {}),
      },
      data: {
        taglineEs: data.taglineEs ?? null,
        descriptionEs: data.descriptionEs ?? null,
        metaTitleEs: data.metaTitleEs ?? null,
        metaDescriptionEs: data.metaDescriptionEs ?? null,
        lastEditedById: user.id,
      },
      select: { updatedAt: true, code: true },
    });
    REVALIDATE_PATHS.department(updated.code).forEach((p) => revalidatePath(p));
    return { ok: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (err) {
    return handleP2025orRethrow(err);
  }
}

export async function updateLocality(
  id: string,
  raw: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
): Promise<UpdateGeoResult> {
  const { user } = await requireRole(["ADMIN", "EDITOR"]);

  const parsed = GeoEditorialContentSchema.safeParse(raw);
  const errors = flattenErrors(parsed);
  if (errors || !parsed.success) {
    return { ok: false, ...errors };
  }
  const data = parsed.data;

  try {
    const updated = await prisma.locality.update({
      where: {
        id,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : {}),
      },
      data: {
        taglineEs: data.taglineEs ?? null,
        descriptionEs: data.descriptionEs ?? null,
        metaTitleEs: data.metaTitleEs ?? null,
        metaDescriptionEs: data.metaDescriptionEs ?? null,
        lastEditedById: user.id,
      },
      select: { updatedAt: true, code: true },
    });
    REVALIDATE_PATHS.locality(updated.code).forEach((p) => revalidatePath(p));
    return { ok: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (err) {
    return handleP2025orRethrow(err);
  }
}
