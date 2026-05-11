import type { Listing } from "@/generated/prisma/client";
import type { TranslationState } from "./dispatcher";

/*
  Mappers explícitos entre entities Prisma y `TranslationState`. Solo
  Listing los necesita: las 4 entities geo (Region/Province/Department/
  Locality) leen vía `getTranslationState` directamente que ya devuelve
  `TranslationState | null`, sin cast intermedio.

  Listing es diferente porque su server action de update hace un
  `findUnique` con `include: { categories, locality }` para los chequeos
  de CAS + critical fields + categories diff. Ese mismo read incluye
  los 22 fields de traducción (Prisma include preserva los scalars del
  modelo principal), así que vale reusarlo en lugar de agregar un
  round-trip extra a `getTranslationState`.

  El cast `existing as unknown as TranslationState` que estaba en uso
  hasta este commit funcionaba estructuralmente pero apagaba TS — si
  alguien restringe el select del findUnique en el futuro (perf
  optimization), el cast seguía pasando y el orchestrator leía
  undefined silenciosamente. El mapper explicito captura el contrato:
  si Listing pierde alguno de estos 22 fields, TS rompe.

  Si en el futuro otra entity necesita un read con `include` específico
  + traducciones, agregar un mapper análogo acá. Si todos pueden usar
  `getTranslationState`, no hay necesidad.
*/

export function mapListingToTranslationState(
  listing: Listing,
): TranslationState {
  return {
    id: listing.id,
    // ES (fuente de verdad). Listing.descriptionEs es NOT NULL en el
    // schema; el TranslationState lo tipa como `string | null` para
    // unificar con los 4 modelos geo donde sí es nullable.
    taglineEs: listing.taglineEs,
    descriptionEs: listing.descriptionEs,
    // EN
    taglineEn: listing.taglineEn,
    taglineEnSource: listing.taglineEnSource,
    taglineEnTranslatedAt: listing.taglineEnTranslatedAt,
    taglineEnPendingRetry: listing.taglineEnPendingRetry,
    descriptionEn: listing.descriptionEn,
    descriptionEnSource: listing.descriptionEnSource,
    descriptionEnTranslatedAt: listing.descriptionEnTranslatedAt,
    descriptionEnPendingRetry: listing.descriptionEnPendingRetry,
    // PT-BR
    taglinePtBr: listing.taglinePtBr,
    taglinePtBrSource: listing.taglinePtBrSource,
    taglinePtBrTranslatedAt: listing.taglinePtBrTranslatedAt,
    taglinePtBrPendingRetry: listing.taglinePtBrPendingRetry,
    descriptionPtBr: listing.descriptionPtBr,
    descriptionPtBrSource: listing.descriptionPtBrSource,
    descriptionPtBrTranslatedAt: listing.descriptionPtBrTranslatedAt,
    descriptionPtBrPendingRetry: listing.descriptionPtBrPendingRetry,
    // Snapshots del `*Es` al momento de cada traducción — base del
    // drift detection en el panel admin.
    taglineEsAtTranslationEn: listing.taglineEsAtTranslationEn,
    taglineEsAtTranslationPtBr: listing.taglineEsAtTranslationPtBr,
    descriptionEsAtTranslationEn: listing.descriptionEsAtTranslationEn,
    descriptionEsAtTranslationPtBr: listing.descriptionEsAtTranslationPtBr,
  };
}
