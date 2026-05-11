-- v0.3-geo-b follow-up: snapshot del texto fuente al momento de cada
-- traducción para detectar drift sin depender de timestamps.
--
-- El `hasDrift` anterior comparaba `translatedAt < parentUpdatedAt`,
-- lo que disparaba falsos positivos en dos escenarios reales:
--
-- A) Editor con `descriptionEnSource = REVIEWED` cambia SOLO un campo
--    no traducible (ej. metaTitleEs). El UPDATE bumpea `updatedAt` →
--    el comparador detecta drift aunque `descriptionEs` no cambió.
--
-- B) Justo después de marcar una traducción como REVIEWED via
--    `markTranslationAsReviewed`. `translatedAt = new Date()` (T_js)
--    se setea unos ms ANTES de que Prisma inyecte `updatedAt =
--    new Date()` al armar el UPDATE → T_js < T_updated → banner
--    falso aparece 1s después de marcar la revisión.
--
-- Fix: persistir el snapshot del `*Es` al momento de la traducción y
-- comparar `current.*Es !== snapshot` (cero ambigüedad de ms). 20
-- columnas nuevas (4 por tabla × 5 tablas), todas TEXT NULL — sin
-- default a nivel DB.
--
-- Backfill: para rows con source REVIEWED/HUMAN ya existentes, copiar
-- el `*Es` actual al snapshot. Asume "el editor revisó la traducción
-- contra el texto ES tal como está hoy". No es 100% correcto
-- históricamente, pero evita una avalancha de banners falsos en el
-- primer despliegue. Rows con source NONE/MACHINE no se backfillean
-- — `hasDrift` los ignora por el guard de source.

-- === Region ===
ALTER TABLE "Region"
  ADD COLUMN "taglineEsAtTranslationEn"       TEXT,
  ADD COLUMN "taglineEsAtTranslationPtBr"     TEXT,
  ADD COLUMN "descriptionEsAtTranslationEn"   TEXT,
  ADD COLUMN "descriptionEsAtTranslationPtBr" TEXT;

UPDATE "Region" SET "taglineEsAtTranslationEn"       = "taglineEs"     WHERE "taglineEnSource"       IN ('REVIEWED', 'HUMAN');
UPDATE "Region" SET "taglineEsAtTranslationPtBr"     = "taglineEs"     WHERE "taglinePtBrSource"     IN ('REVIEWED', 'HUMAN');
UPDATE "Region" SET "descriptionEsAtTranslationEn"   = "descriptionEs" WHERE "descriptionEnSource"   IN ('REVIEWED', 'HUMAN');
UPDATE "Region" SET "descriptionEsAtTranslationPtBr" = "descriptionEs" WHERE "descriptionPtBrSource" IN ('REVIEWED', 'HUMAN');

-- === Province ===
ALTER TABLE "Province"
  ADD COLUMN "taglineEsAtTranslationEn"       TEXT,
  ADD COLUMN "taglineEsAtTranslationPtBr"     TEXT,
  ADD COLUMN "descriptionEsAtTranslationEn"   TEXT,
  ADD COLUMN "descriptionEsAtTranslationPtBr" TEXT;

UPDATE "Province" SET "taglineEsAtTranslationEn"       = "taglineEs"     WHERE "taglineEnSource"       IN ('REVIEWED', 'HUMAN');
UPDATE "Province" SET "taglineEsAtTranslationPtBr"     = "taglineEs"     WHERE "taglinePtBrSource"     IN ('REVIEWED', 'HUMAN');
UPDATE "Province" SET "descriptionEsAtTranslationEn"   = "descriptionEs" WHERE "descriptionEnSource"   IN ('REVIEWED', 'HUMAN');
UPDATE "Province" SET "descriptionEsAtTranslationPtBr" = "descriptionEs" WHERE "descriptionPtBrSource" IN ('REVIEWED', 'HUMAN');

-- === Department ===
ALTER TABLE "Department"
  ADD COLUMN "taglineEsAtTranslationEn"       TEXT,
  ADD COLUMN "taglineEsAtTranslationPtBr"     TEXT,
  ADD COLUMN "descriptionEsAtTranslationEn"   TEXT,
  ADD COLUMN "descriptionEsAtTranslationPtBr" TEXT;

UPDATE "Department" SET "taglineEsAtTranslationEn"       = "taglineEs"     WHERE "taglineEnSource"       IN ('REVIEWED', 'HUMAN');
UPDATE "Department" SET "taglineEsAtTranslationPtBr"     = "taglineEs"     WHERE "taglinePtBrSource"     IN ('REVIEWED', 'HUMAN');
UPDATE "Department" SET "descriptionEsAtTranslationEn"   = "descriptionEs" WHERE "descriptionEnSource"   IN ('REVIEWED', 'HUMAN');
UPDATE "Department" SET "descriptionEsAtTranslationPtBr" = "descriptionEs" WHERE "descriptionPtBrSource" IN ('REVIEWED', 'HUMAN');

-- === Locality ===
ALTER TABLE "Locality"
  ADD COLUMN "taglineEsAtTranslationEn"       TEXT,
  ADD COLUMN "taglineEsAtTranslationPtBr"     TEXT,
  ADD COLUMN "descriptionEsAtTranslationEn"   TEXT,
  ADD COLUMN "descriptionEsAtTranslationPtBr" TEXT;

UPDATE "Locality" SET "taglineEsAtTranslationEn"       = "taglineEs"     WHERE "taglineEnSource"       IN ('REVIEWED', 'HUMAN');
UPDATE "Locality" SET "taglineEsAtTranslationPtBr"     = "taglineEs"     WHERE "taglinePtBrSource"     IN ('REVIEWED', 'HUMAN');
UPDATE "Locality" SET "descriptionEsAtTranslationEn"   = "descriptionEs" WHERE "descriptionEnSource"   IN ('REVIEWED', 'HUMAN');
UPDATE "Locality" SET "descriptionEsAtTranslationPtBr" = "descriptionEs" WHERE "descriptionPtBrSource" IN ('REVIEWED', 'HUMAN');

-- === Listing ===
ALTER TABLE "Listing"
  ADD COLUMN "taglineEsAtTranslationEn"       TEXT,
  ADD COLUMN "taglineEsAtTranslationPtBr"     TEXT,
  ADD COLUMN "descriptionEsAtTranslationEn"   TEXT,
  ADD COLUMN "descriptionEsAtTranslationPtBr" TEXT;

UPDATE "Listing" SET "taglineEsAtTranslationEn"       = "taglineEs"     WHERE "taglineEnSource"       IN ('REVIEWED', 'HUMAN');
UPDATE "Listing" SET "taglineEsAtTranslationPtBr"     = "taglineEs"     WHERE "taglinePtBrSource"     IN ('REVIEWED', 'HUMAN');
UPDATE "Listing" SET "descriptionEsAtTranslationEn"   = "descriptionEs" WHERE "descriptionEnSource"   IN ('REVIEWED', 'HUMAN');
UPDATE "Listing" SET "descriptionEsAtTranslationPtBr" = "descriptionEs" WHERE "descriptionPtBrSource" IN ('REVIEWED', 'HUMAN');
