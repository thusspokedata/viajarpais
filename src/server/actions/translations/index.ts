"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { type TranslationTarget } from "@/lib/deepl";
import {
  markTranslationAsReviewed,
  runForceRetranslate,
  runRetryPending,
  type TranslatableField,
  type TranslationStatus,
} from "@/lib/translations/orchestrator";
import { type EntityType } from "@/lib/translations/dispatcher";

/*
  Server actions del panel de traducciones. 3 verbos:

  - `retryPendingTranslations`: el banner naranja del admin dispara este
    cuando hay campos en `*PendingRetry = true`. Reintenta DeepL.
  - `markTranslationManuallyEdited`: el editor cliquea "Editar
    manualmente", escribe la traducción y guarda. El source pasa a
    REVIEWED.
  - `forceRetranslateField`: el editor cliquea "Re-traducir desde
    español" y confirma el modal. Pisa lo existente con una nueva
    versión MACHINE.

  Todas reciben `EntityType` para despachar al delegate correcto y
  validan inputs con zod antes de tocar DB. Defensa en profundidad:
  `requireRole(["ADMIN", "EDITOR"])` aunque el layout ya gate-kea.

  `revalidatePath` apunta a las paths admin que muestran el panel —
  forzar refresh para que el badge "Auto/Revisada/Manual" + el banner
  de drift queden alineados con DB sin requerir reload manual.
*/

const ENTITY_TYPE_VALUES = [
  "region",
  "province",
  "department",
  "locality",
  "listing",
] as const satisfies readonly EntityType[];

const LANG_VALUES = ["en-US", "pt-BR"] as const satisfies readonly TranslationTarget[];

const FIELD_VALUES = [
  "tagline",
  "description",
] as const satisfies readonly TranslatableField[];

/**
 * Cada nivel se rutea por `code` (Georef ID) o por `id` (Listing).
 * Cuando aplica revalidate al panel, necesitamos saber el path que
 * sirve la página. El caller pasa `code` (geo) o `id` (Listing) en el
 * payload — esta función arma las paths admin correspondientes.
 *
 * Pasamos `code` opcional porque la server action solo recibe el
 * `entityId` (cuid) — el caller del panel del Listing pasa null para
 * `code`, y construimos el path con el id directamente.
 */
function buildAdminPaths(
  type: EntityType,
  identifier: string,
): string[] {
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

const BasePayloadSchema = z.object({
  entityType: z.enum(ENTITY_TYPE_VALUES),
  entityId: z.string().min(1, "entityId requerido"),
  /**
   * Identificador para construir la `revalidatePath` de la página admin
   * del item. Para geo se pasa el `code` (Georef ID); para Listing,
   * el `id` (cuid). Si no se pasa, el revalidate se saltea y el
   * editor verá los cambios al recargar.
   */
  revalidateIdentifier: z.string().optional(),
});

export type TranslationActionResult =
  | { ok: true; status: TranslationStatus }
  | { ok: false; message: string };

const RetryPayloadSchema = BasePayloadSchema;

/**
 * Reintenta DeepL para los campos del row con `*PendingRetry = true`.
 * El editor dispara esto desde el banner naranja del panel.
 */
export async function retryPendingTranslations(
  raw: z.infer<typeof RetryPayloadSchema>,
): Promise<TranslationActionResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const parsed = RetryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Parámetros inválidos." };
  }
  const { entityType, entityId, revalidateIdentifier } = parsed.data;

  try {
    const status = await runRetryPending({ type: entityType, id: entityId });

    if (revalidateIdentifier) {
      buildAdminPaths(entityType, revalidateIdentifier).forEach((p) =>
        revalidatePath(p),
      );
    }

    return { ok: true, status };
  } catch (err) {
    console.error("[translations.retry]", err);
    return {
      ok: false,
      message:
        "No se pudo reintentar la traducción. Probá de nuevo en unos segundos.",
    };
  }
}

const ForcePayloadSchema = BasePayloadSchema.extend({
  lang: z.enum(LANG_VALUES),
  fields: z.array(z.enum(FIELD_VALUES)).optional(),
});

/**
 * Pisa la traducción del idioma indicado con una nueva versión MACHINE.
 * El editor confirma esto desde el modal del panel cuando quiere
 * regenerar una traducción `MACHINE` (sin modal) o `REVIEWED`/`HUMAN`
 * (con modal de confirmación obligatorio en el cliente).
 *
 * Si `fields` no viene, se pisan ambos campos (tagline + description).
 */
export async function forceRetranslateField(
  raw: z.infer<typeof ForcePayloadSchema>,
): Promise<TranslationActionResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const parsed = ForcePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Parámetros inválidos." };
  }
  const { entityType, entityId, lang, fields, revalidateIdentifier } =
    parsed.data;

  try {
    const status = await runForceRetranslate({
      type: entityType,
      id: entityId,
      lang,
      selection: { fields },
    });

    if (revalidateIdentifier) {
      buildAdminPaths(entityType, revalidateIdentifier).forEach((p) =>
        revalidatePath(p),
      );
    }

    return { ok: true, status };
  } catch (err) {
    console.error("[translations.force]", err);
    return {
      ok: false,
      message:
        "No se pudo re-traducir el contenido. Probá de nuevo en unos segundos.",
    };
  }
}

const ReviewedPayloadSchema = BasePayloadSchema.extend({
  lang: z.enum(LANG_VALUES),
  // Strings; null para "borrar el contenido manual y dejar vacío".
  // undefined para "no tocar este campo en DB" (caller del panel pasa
  // undefined explícito cuando el textarea no cambió respecto al
  // server side — sino, el server flippearía el `*Source` a REVIEWED
  // aunque no se haya tocado ese campo).
  taglineText: z
    .string()
    .max(120)
    .nullable()
    .optional(),
  descriptionText: z.string().max(5000).nullable().optional(),
}).refine(
  (data) => data.taglineText !== undefined || data.descriptionText !== undefined,
  {
    message:
      "At least one of taglineText or descriptionText must be provided (defense in depth — el panel cliente ya filtra este caso).",
    path: ["taglineText"],
  },
);

/**
 * Guarda la edición manual de una traducción. El source pasa a
 * REVIEWED. Llamado desde el panel cuando el editor expande el
 * textarea, edita, y cliquea "Guardar".
 */
export async function markTranslationManuallyEdited(
  raw: z.infer<typeof ReviewedPayloadSchema>,
): Promise<TranslationActionResult> {
  await requireRole(["ADMIN", "EDITOR"]);

  const parsed = ReviewedPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Parámetros inválidos." };
  }
  const {
    entityType,
    entityId,
    lang,
    taglineText,
    descriptionText,
    revalidateIdentifier,
  } = parsed.data;

  if (taglineText === undefined && descriptionText === undefined) {
    return {
      ok: false,
      message: "No hay cambios para guardar.",
    };
  }

  try {
    // XSS: `taglineText` y `descriptionText` se persisten sin
    // sanitizar. La sanitización es OBLIGATORIA en v0.4 cuando estos
    // campos se rendericen como HTML/Markdown público. Ver AGENTS.md
    // → "Sanitización de Markdown del editor".
    await markTranslationAsReviewed({
      type: entityType,
      id: entityId,
      lang,
      taglineText,
      descriptionText,
    });

    if (revalidateIdentifier) {
      buildAdminPaths(entityType, revalidateIdentifier).forEach((p) =>
        revalidatePath(p),
      );
    }

    // Marcar como REVIEWED no involucra DeepL — devolvemos `skipped`
    // por idioma como señal "nada que reportar al toast".
    return {
      ok: true,
      status: {
        en: lang === "en-US" ? "success" : "skipped",
        ptBr: lang === "pt-BR" ? "success" : "skipped",
      },
    };
  } catch (err) {
    console.error("[translations.reviewed]", err);
    return {
      ok: false,
      message: "No se pudo guardar la edición manual.",
    };
  }
}
