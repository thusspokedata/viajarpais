import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, TranslationSource } from "@/generated/prisma/client";

/*
  Dispatcher para los 5 modelos que tienen contenido editorial
  traducible (Region, Province, Department, Locality, Listing). Cada
  uno usa un delegate distinto de Prisma; este módulo encapsula el
  switch para que el orchestrator + las server actions del panel
  trabajen contra una API homogénea.

  Solo tocamos los campos de traducción (taglineEn/PtBr, descriptionEn/
  PtBr y sus metadatos: Source/TranslatedAt/PendingRetry). El campo
  `*Es` se lee únicamente para alimentar DeepL — nunca se escribe acá.
*/

export type EntityType =
  | "region"
  | "province"
  | "department"
  | "locality"
  | "listing";

/**
 * Select compartido que devuelve todos los campos relevantes para la
 * lógica de traducción. Como `as const`, Prisma infiere el shape de
 * cada find resolviendo a los tipos exactos por modelo.
 */
export const TRANSLATION_FIELDS_SELECT = {
  id: true,
  // ES (fuente de verdad)
  taglineEs: true,
  descriptionEs: true,
  // EN
  taglineEn: true,
  taglineEnSource: true,
  taglineEnTranslatedAt: true,
  taglineEnPendingRetry: true,
  descriptionEn: true,
  descriptionEnSource: true,
  descriptionEnTranslatedAt: true,
  descriptionEnPendingRetry: true,
  // PT-BR
  taglinePtBr: true,
  taglinePtBrSource: true,
  taglinePtBrTranslatedAt: true,
  taglinePtBrPendingRetry: true,
  descriptionPtBr: true,
  descriptionPtBrSource: true,
  descriptionPtBrTranslatedAt: true,
  descriptionPtBrPendingRetry: true,
  // Snapshot del `*Es` al momento de cada traducción — base para el
  // drift detection del panel (ver schema y orchestrator).
  taglineEsAtTranslationEn: true,
  taglineEsAtTranslationPtBr: true,
  descriptionEsAtTranslationEn: true,
  descriptionEsAtTranslationPtBr: true,
} as const;

/**
 * Shape uniforme que devuelven todos los modelos cuando se lee con
 * `TRANSLATION_FIELDS_SELECT`. `taglineEs` y `descriptionEs` se tipan
 * como `string | null` aunque en Listing son NOT NULL — el call site
 * que recibe el state genérico no necesita distinguir, y el typing
 * laxo evita un type union explícito por entityType.
 */
export type TranslationState = {
  id: string;
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
  taglineEsAtTranslationEn: string | null;
  taglineEsAtTranslationPtBr: string | null;
  descriptionEsAtTranslationEn: string | null;
  descriptionEsAtTranslationPtBr: string | null;
};

/**
 * Subset de campos que la lógica de traducción puede escribir. NUNCA
 * incluye `*Es` (la fuente de verdad la maneja el update server action
 * principal, no el orchestrator de traducción) salvo los snapshots
 * `*EsAtTranslation*` que sí son responsabilidad del orchestrator.
 */
export type TranslationUpdateData = {
  taglineEn?: string | null;
  taglineEnSource?: TranslationSource;
  taglineEnTranslatedAt?: Date | null;
  taglineEnPendingRetry?: boolean;
  descriptionEn?: string | null;
  descriptionEnSource?: TranslationSource;
  descriptionEnTranslatedAt?: Date | null;
  descriptionEnPendingRetry?: boolean;
  taglinePtBr?: string | null;
  taglinePtBrSource?: TranslationSource;
  taglinePtBrTranslatedAt?: Date | null;
  taglinePtBrPendingRetry?: boolean;
  descriptionPtBr?: string | null;
  descriptionPtBrSource?: TranslationSource;
  descriptionPtBrTranslatedAt?: Date | null;
  descriptionPtBrPendingRetry?: boolean;
  taglineEsAtTranslationEn?: string | null;
  taglineEsAtTranslationPtBr?: string | null;
  descriptionEsAtTranslationEn?: string | null;
  descriptionEsAtTranslationPtBr?: string | null;
};

/**
 * Lee el estado de traducción de un row. Devuelve `null` si el row no
 * existe (caller decide el manejo — el orchestrator lo trata como
 * "operación no aplica, salir limpio").
 */
export async function getTranslationState(
  type: EntityType,
  id: string,
): Promise<TranslationState | null> {
  switch (type) {
    case "region":
      return prisma.region.findUnique({
        where: { id },
        select: TRANSLATION_FIELDS_SELECT,
      });
    case "province":
      return prisma.province.findUnique({
        where: { id },
        select: TRANSLATION_FIELDS_SELECT,
      });
    case "department":
      return prisma.department.findUnique({
        where: { id },
        select: TRANSLATION_FIELDS_SELECT,
      });
    case "locality":
      return prisma.locality.findUnique({
        where: { id },
        select: TRANSLATION_FIELDS_SELECT,
      });
    case "listing":
      return prisma.listing.findUnique({
        where: { id },
        select: TRANSLATION_FIELDS_SELECT,
      });
  }
}

/**
 * Aplica un parcial de `TranslationUpdateData` al row correspondiente.
 * No usamos `lastEditedById` acá — la traducción automática NO es una
 * "edición humana", queda atribuida al editor que disparó el save
 * original (eso ya quedó seteado en el update principal).
 *
 * Toma el caller con `Prisma.<Model>UpdateInput` de forma asegurada
 * dentro del switch — el typing laxo público (`TranslationUpdateData`)
 * se reduce a la forma específica del modelo en cada case.
 */
export async function applyTranslationUpdate(
  type: EntityType,
  id: string,
  data: TranslationUpdateData,
): Promise<void> {
  switch (type) {
    case "region":
      await prisma.region.update({
        where: { id },
        data: data as Prisma.RegionUpdateInput,
      });
      return;
    case "province":
      await prisma.province.update({
        where: { id },
        data: data as Prisma.ProvinceUpdateInput,
      });
      return;
    case "department":
      await prisma.department.update({
        where: { id },
        data: data as Prisma.DepartmentUpdateInput,
      });
      return;
    case "locality":
      await prisma.locality.update({
        where: { id },
        data: data as Prisma.LocalityUpdateInput,
      });
      return;
    case "listing":
      await prisma.listing.update({
        where: { id },
        data: data as Prisma.ListingUpdateInput,
      });
      return;
  }
}
