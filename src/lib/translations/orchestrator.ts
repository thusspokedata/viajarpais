import "server-only";
import { translateText, type TranslationTarget } from "@/lib/deepl";
import {
  applyTranslationUpdate,
  getTranslationState,
  type EntityType,
  type TranslationState,
  type TranslationUpdateData,
} from "./dispatcher";

/*
  Orquestador de traducciones DeepL. Encapsula las 3 operaciones que
  necesitan los callers del PR:

  1. `runAutoTranslation` — disparada post-update por las server actions
     de Region/Province/Department/Locality/Listing. Mira qué campos en
     español cambiaron y para cada idioma destino (EN-US, PT-BR) decide
     si regenerar la traducción.

     Regla clave (cerrada en chat, ver AGENTS.md §"i18n del contenido
     editorial"): si el `source` actual de la traducción es MACHINE o
     NONE, se regenera automáticamente; si es REVIEWED o HUMAN, NO se
     regenera. El editor verá el banner de drift en el panel y decide
     explícitamente con "Re-traducir desde español" (que invoca
     `runForceRetranslate`).

  2. `runForceRetranslate` — disparada por el botón "Re-traducir desde
     español" del panel admin. Bypassa el guard del source — sí o sí
     regenera el campo solicitado para el idioma solicitado.

  3. `runRetryPending` — disparada por el botón "Reintentar ahora" del
     banner naranja. Reintenta las traducciones que tienen
     `*PendingRetry = true` (típicamente porque DeepL falló o la cuota
     se había excedido en un save previo).

  Todas devuelven un `TranslationStatus` por idioma para que el caller
  pueda decidir qué toast mostrar.
*/

export type TranslationOutcome = "success" | "failed" | "quota" | "skipped";

export type TranslationStatus = {
  en: TranslationOutcome;
  ptBr: TranslationOutcome;
};

export type TranslatableField = "tagline" | "description";

/**
 * Lista de pares (campo, idioma) que el caller pidió procesar. Si
 * `fields` es undefined se asume `['tagline', 'description']`.
 */
export type FieldSelection = {
  fields?: TranslatableField[];
};

const ALL_FIELDS: TranslatableField[] = ["tagline", "description"];

/**
 * Mira los `previousValues` (lo que estaba en DB antes del UPDATE) vs
 * los `nextValues` (lo que el editor acaba de mandar) y dispara DeepL
 * solo para los campos que efectivamente cambiaron. Llamar después de
 * que el UPDATE principal del español ya esté commiteado.
 *
 * `previousState` se pasa por argumento porque el caller (el update
 * server action) ya hizo un `findUnique` para CAS check + cambios
 * críticos. Reusamos ese read para no agregar una round-trip extra.
 */
export async function runAutoTranslation(args: {
  type: EntityType;
  id: string;
  previousState: TranslationState;
  nextValues: { taglineEs: string | null; descriptionEs: string | null };
}): Promise<TranslationStatus> {
  const { type, id, previousState, nextValues } = args;

  const fieldsChanged: TranslatableField[] = [];
  if ((previousState.taglineEs ?? null) !== (nextValues.taglineEs ?? null)) {
    fieldsChanged.push("tagline");
  }
  if (
    (previousState.descriptionEs ?? null) !== (nextValues.descriptionEs ?? null)
  ) {
    fieldsChanged.push("description");
  }

  if (fieldsChanged.length === 0) {
    return { en: "skipped", ptBr: "skipped" };
  }

  /*
    Re-leemos el state después del update para tener los valores `*Es`
    ya actualizados — la traducción debe usar el contenido nuevo, no
    el viejo de `previousState`. Pero conservamos los `Source` /
    `*PendingRetry` que vimos antes del UPDATE como referencia para el
    skip de REVIEWED/HUMAN — el update no toca esos campos así que el
    valor previo y el actual coinciden.
  */
  const current = await getTranslationState(type, id);
  if (!current) {
    // El row desapareció entre el UPDATE y este read. Caller decide.
    return { en: "skipped", ptBr: "skipped" };
  }

  return runTranslationsForFields({
    type,
    id,
    state: current,
    fieldsToProcess: fieldsChanged,
    respectSourceGuard: true,
  });
}

/**
 * Versión "manual" del panel: el editor pidió re-traducir un idioma
 * específico. Bypassa el guard del source — el caller se asegura de
 * pedir confirmación al editor cuando el source sería pisado
 * (REVIEWED o HUMAN).
 *
 * Si `fields` no se especifica, se procesan ambos (`tagline` +
 * `description`).
 */
export async function runForceRetranslate(args: {
  type: EntityType;
  id: string;
  lang: TranslationTarget;
  selection?: FieldSelection;
}): Promise<TranslationStatus> {
  const { type, id, lang, selection } = args;
  const state = await getTranslationState(type, id);
  if (!state) {
    return { en: "skipped", ptBr: "skipped" };
  }

  const result = await runTranslationsForFields({
    type,
    id,
    state,
    fieldsToProcess: selection?.fields ?? ALL_FIELDS,
    respectSourceGuard: false,
    targetLangs: [lang],
  });

  return result;
}

/**
 * Reintenta las traducciones que estén con `*PendingRetry = true`.
 * Útil cuando un save previo encontró DeepL caído o cuota excedida.
 * Si todo está limpio, devuelve outcomes `skipped`.
 */
export async function runRetryPending(args: {
  type: EntityType;
  id: string;
}): Promise<TranslationStatus> {
  const { type, id } = args;
  const state = await getTranslationState(type, id);
  if (!state) {
    return { en: "skipped", ptBr: "skipped" };
  }

  // Detectar qué campos × idiomas tienen pending.
  const fieldsToProcess: TranslatableField[] = [];
  if (state.taglineEnPendingRetry || state.taglinePtBrPendingRetry) {
    fieldsToProcess.push("tagline");
  }
  if (
    state.descriptionEnPendingRetry ||
    state.descriptionPtBrPendingRetry
  ) {
    fieldsToProcess.push("description");
  }

  if (fieldsToProcess.length === 0) {
    return { en: "skipped", ptBr: "skipped" };
  }

  return runTranslationsForFields({
    type,
    id,
    state,
    fieldsToProcess,
    // Retry sigue respetando el source guard — si entre tanto el
    // editor marcó REVIEWED manualmente, no queremos pisarlo.
    respectSourceGuard: true,
    // Pero solo procesa los idiomas que están en pending — los otros
    // ya están OK.
    onlyIfPending: true,
  });
}

/**
 * Core compartido por las 3 operaciones de arriba. Itera por (campo ×
 * idioma) y decide independientemente si traducir o saltar. Acumula
 * las escrituras en un solo `applyTranslationUpdate` al final para
 * minimizar round-trips a la DB.
 */
async function runTranslationsForFields(args: {
  type: EntityType;
  id: string;
  state: TranslationState;
  fieldsToProcess: TranslatableField[];
  /** Si true (default auto-translate), salta REVIEWED y HUMAN. */
  respectSourceGuard: boolean;
  /** Si true, además del source guard, salta el par si no está en pending. */
  onlyIfPending?: boolean;
  /** Idiomas a procesar. Default ambos. */
  targetLangs?: TranslationTarget[];
}): Promise<TranslationStatus> {
  const targetLangs = args.targetLangs ?? ["en-US", "pt-BR"];
  const data: TranslationUpdateData = {};
  let outcomeEn: TranslationOutcome = "skipped";
  let outcomePtBr: TranslationOutcome = "skipped";

  for (const lang of targetLangs) {
    for (const field of args.fieldsToProcess) {
      const outcome = await translateOne({
        state: args.state,
        field,
        lang,
        respectSourceGuard: args.respectSourceGuard,
        onlyIfPending: args.onlyIfPending ?? false,
        out: data,
      });
      // Solo escalamos el outcome si es distinto a "skipped" — un
      // skipped en un campo no debe pisar un success en otro.
      if (lang === "en-US") {
        outcomeEn = mergeOutcome(outcomeEn, outcome);
      } else {
        outcomePtBr = mergeOutcome(outcomePtBr, outcome);
      }
    }
  }

  if (Object.keys(data).length > 0) {
    await applyTranslationUpdate(args.type, args.id, data);
  }

  return { en: outcomeEn, ptBr: outcomePtBr };
}

/**
 * Procesa un par (campo, idioma) — decide si llamar a DeepL o saltar,
 * y si llama, acumula los writes en `out`. Devuelve el outcome
 * individual.
 */
async function translateOne(args: {
  state: TranslationState;
  field: TranslatableField;
  lang: TranslationTarget;
  respectSourceGuard: boolean;
  onlyIfPending: boolean;
  out: TranslationUpdateData;
}): Promise<TranslationOutcome> {
  const { state, field, lang, respectSourceGuard, onlyIfPending, out } = args;
  const sourceText = field === "tagline" ? state.taglineEs : state.descriptionEs;

  // Si no hay texto base, no hay nada que traducir. Limpiamos la
  // versión vieja para evitar mantener un texto huérfano.
  if (!sourceText || sourceText.trim() === "") {
    setTranslationField(out, field, lang, {
      text: null,
      source: "NONE",
      translatedAt: null,
      pendingRetry: false,
    });
    return "skipped";
  }

  const currentSource = readSource(state, field, lang);
  const currentPending = readPending(state, field, lang);

  // Guard de source: si el editor revisó/escribió esta versión, no
  // sobreescribir automáticamente.
  if (
    respectSourceGuard &&
    (currentSource === "REVIEWED" || currentSource === "HUMAN")
  ) {
    return "skipped";
  }

  if (onlyIfPending && !currentPending) {
    return "skipped";
  }

  const result = await translateText(sourceText, lang);
  if (result.ok) {
    setTranslationField(out, field, lang, {
      text: result.text,
      source: "MACHINE",
      translatedAt: new Date(),
      pendingRetry: false,
    });
    return "success";
  }

  // Falló: marcar pendingRetry, no tocar el texto previo.
  setTranslationField(out, field, lang, {
    pendingRetry: true,
  });
  return result.reason === "QUOTA_EXCEEDED" ? "quota" : "failed";
}

function mergeOutcome(
  acc: TranslationOutcome,
  next: TranslationOutcome,
): TranslationOutcome {
  // Prioridad descendente: quota > failed > success > skipped. Eso
  // garantiza que el toast más "ruidoso" gana — si CUALQUIER campo
  // falló por cuota, el editor debe ver el toast amarillo de cuota.
  const rank: Record<TranslationOutcome, number> = {
    quota: 4,
    failed: 3,
    success: 2,
    skipped: 1,
  };
  return rank[next] > rank[acc] ? next : acc;
}

function readSource(
  state: TranslationState,
  field: TranslatableField,
  lang: TranslationTarget,
) {
  if (field === "tagline") {
    return lang === "en-US" ? state.taglineEnSource : state.taglinePtBrSource;
  }
  return lang === "en-US"
    ? state.descriptionEnSource
    : state.descriptionPtBrSource;
}

function readPending(
  state: TranslationState,
  field: TranslatableField,
  lang: TranslationTarget,
): boolean {
  if (field === "tagline") {
    return lang === "en-US"
      ? state.taglineEnPendingRetry
      : state.taglinePtBrPendingRetry;
  }
  return lang === "en-US"
    ? state.descriptionEnPendingRetry
    : state.descriptionPtBrPendingRetry;
}

function setTranslationField(
  out: TranslationUpdateData,
  field: TranslatableField,
  lang: TranslationTarget,
  values: {
    text?: string | null;
    source?: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
    translatedAt?: Date | null;
    pendingRetry?: boolean;
  },
): void {
  const isEn = lang === "en-US";
  if (field === "tagline") {
    if (values.text !== undefined) {
      if (isEn) out.taglineEn = values.text;
      else out.taglinePtBr = values.text;
    }
    if (values.source !== undefined) {
      if (isEn) out.taglineEnSource = values.source;
      else out.taglinePtBrSource = values.source;
    }
    if (values.translatedAt !== undefined) {
      if (isEn) out.taglineEnTranslatedAt = values.translatedAt;
      else out.taglinePtBrTranslatedAt = values.translatedAt;
    }
    if (values.pendingRetry !== undefined) {
      if (isEn) out.taglineEnPendingRetry = values.pendingRetry;
      else out.taglinePtBrPendingRetry = values.pendingRetry;
    }
    return;
  }
  // description
  if (values.text !== undefined) {
    if (isEn) out.descriptionEn = values.text;
    else out.descriptionPtBr = values.text;
  }
  if (values.source !== undefined) {
    if (isEn) out.descriptionEnSource = values.source;
    else out.descriptionPtBrSource = values.source;
  }
  if (values.translatedAt !== undefined) {
    if (isEn) out.descriptionEnTranslatedAt = values.translatedAt;
    else out.descriptionPtBrTranslatedAt = values.translatedAt;
  }
  if (values.pendingRetry !== undefined) {
    if (isEn) out.descriptionEnPendingRetry = values.pendingRetry;
    else out.descriptionPtBrPendingRetry = values.pendingRetry;
  }
}

/**
 * Versión "editar manualmente" del panel: el editor pisó la traducción
 * a mano. Marca el source como REVIEWED + actualiza translatedAt +
 * baja pendingRetry. El call site valida los inputs (longitud, no
 * vacío) antes de llamar.
 */
export async function markTranslationAsReviewed(args: {
  type: EntityType;
  id: string;
  lang: TranslationTarget;
  taglineText?: string | null;
  descriptionText?: string | null;
}): Promise<void> {
  const { type, id, lang, taglineText, descriptionText } = args;
  const isEn = lang === "en-US";
  const data: TranslationUpdateData = {};

  if (taglineText !== undefined) {
    if (isEn) {
      data.taglineEn = taglineText;
      data.taglineEnSource = "REVIEWED";
      data.taglineEnTranslatedAt = new Date();
      data.taglineEnPendingRetry = false;
    } else {
      data.taglinePtBr = taglineText;
      data.taglinePtBrSource = "REVIEWED";
      data.taglinePtBrTranslatedAt = new Date();
      data.taglinePtBrPendingRetry = false;
    }
  }
  if (descriptionText !== undefined) {
    if (isEn) {
      data.descriptionEn = descriptionText;
      data.descriptionEnSource = "REVIEWED";
      data.descriptionEnTranslatedAt = new Date();
      data.descriptionEnPendingRetry = false;
    } else {
      data.descriptionPtBr = descriptionText;
      data.descriptionPtBrSource = "REVIEWED";
      data.descriptionPtBrTranslatedAt = new Date();
      data.descriptionPtBrPendingRetry = false;
    }
  }

  if (Object.keys(data).length > 0) {
    await applyTranslationUpdate(type, id, data);
  }
}
