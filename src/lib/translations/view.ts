import type { TranslationSource } from "@/generated/prisma/client";
import type { TranslationFieldsView } from "@/components/admin/TranslationsPanel";

/*
  Helper para convertir un shape Prisma con los campos de traducción
  al shape `TranslationFieldsView` que consume el componente cliente.
  Principal diferencia: `*TranslatedAt` se serializa de `Date` a ISO
  string (los Server Components pueden pasar Dates como prop, pero el
  componente cliente las tipa como string para evitar inferencia
  rara con dates serializadas en RSC payload).
*/

/**
 * Shape esperado por `entityToTranslationsView`. Cualquier modelo
 * (Region, Province, Department, Locality, Listing) leído con los 18
 * campos de traducción matchea este shape gracias a la duck typing
 * de TS. `taglineEs` y `descriptionEs` se aceptan como `string | null`
 * o `string` (Listing) — ambos son compatibles.
 */
export type EntityWithTranslationFields = {
  taglineEs: string | null;
  descriptionEs: string | null;
  taglineEn: string | null;
  taglineEnSource: TranslationSource;
  taglineEnTranslatedAt: Date | null;
  taglineEnPendingRetry: boolean;
  descriptionEn: string | null;
  descriptionEnSource: TranslationSource;
  descriptionEnTranslatedAt: Date | null;
  descriptionEnPendingRetry: boolean;
  taglinePtBr: string | null;
  taglinePtBrSource: TranslationSource;
  taglinePtBrTranslatedAt: Date | null;
  taglinePtBrPendingRetry: boolean;
  descriptionPtBr: string | null;
  descriptionPtBrSource: TranslationSource;
  descriptionPtBrTranslatedAt: Date | null;
  descriptionPtBrPendingRetry: boolean;
};

export function entityToTranslationsView(
  entity: EntityWithTranslationFields,
): TranslationFieldsView {
  return {
    taglineEs: entity.taglineEs,
    descriptionEs: entity.descriptionEs,
    taglineEn: entity.taglineEn,
    taglineEnSource: entity.taglineEnSource,
    taglineEnTranslatedAt: entity.taglineEnTranslatedAt
      ? entity.taglineEnTranslatedAt.toISOString()
      : null,
    taglineEnPendingRetry: entity.taglineEnPendingRetry,
    descriptionEn: entity.descriptionEn,
    descriptionEnSource: entity.descriptionEnSource,
    descriptionEnTranslatedAt: entity.descriptionEnTranslatedAt
      ? entity.descriptionEnTranslatedAt.toISOString()
      : null,
    descriptionEnPendingRetry: entity.descriptionEnPendingRetry,
    taglinePtBr: entity.taglinePtBr,
    taglinePtBrSource: entity.taglinePtBrSource,
    taglinePtBrTranslatedAt: entity.taglinePtBrTranslatedAt
      ? entity.taglinePtBrTranslatedAt.toISOString()
      : null,
    taglinePtBrPendingRetry: entity.taglinePtBrPendingRetry,
    descriptionPtBr: entity.descriptionPtBr,
    descriptionPtBrSource: entity.descriptionPtBrSource,
    descriptionPtBrTranslatedAt: entity.descriptionPtBrTranslatedAt
      ? entity.descriptionPtBrTranslatedAt.toISOString()
      : null,
    descriptionPtBrPendingRetry: entity.descriptionPtBrPendingRetry,
  };
}
