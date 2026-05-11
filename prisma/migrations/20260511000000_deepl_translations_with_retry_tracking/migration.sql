-- v0.3-geo-b: DeepL automatic translation infrastructure.
--
-- Cambios aditivos solamente (no DROP, no RENAME): seguro de aplicar en
-- producción sin pasos manuales. Los `pendingRetry` flags se rellenan a
-- `false` por default, así que filas existentes quedan correctas sin
-- backfill explícito.
--
-- 1) `*PendingRetry` Boolean por idioma (EN/PT-BR) × campo (tagline/
--    description) × modelo (Region, Province, Department, Locality,
--    Listing) = 4 columnas × 5 tablas = 20 columnas nuevas. La server
--    action de update prende este flag cuando dispara DeepL y la
--    traducción falla (3 retries agotados o cuota mensual excedida).
--    El admin muestra banner + botón "Reintentar ahora" mientras el
--    flag esté en true.
--
-- 2) Nueva tabla `TranslationUsage` con contador mensual de caracteres
--    por proveedor. Unique compuesto (`month`, `provider`) para que el
--    upsert por mes sea idempotente. DeepL Free Plan = 500.000 chars/mes.
--
-- El bloque ruidoso `ALTER COLUMN "updatedAt" DROP DEFAULT` que sale
-- en `prisma migrate diff` es drift de Prisma 7 vs la versión anterior
-- que creó esas columnas con `DEFAULT CURRENT_TIMESTAMP` redundante.
-- NO se incluye acá — Prisma client ya escribe el valor en cada
-- update, el default a nivel DB es decorativo. Se limpiará en una
-- migración aparte de housekeeping si hace falta.

-- AlterTable
ALTER TABLE "Region"
  ADD COLUMN "taglineEnPendingRetry"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taglinePtBrPendingRetry"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionEnPendingRetry"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionPtBrPendingRetry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Province"
  ADD COLUMN "taglineEnPendingRetry"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taglinePtBrPendingRetry"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionEnPendingRetry"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionPtBrPendingRetry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Department"
  ADD COLUMN "taglineEnPendingRetry"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taglinePtBrPendingRetry"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionEnPendingRetry"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionPtBrPendingRetry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Locality"
  ADD COLUMN "taglineEnPendingRetry"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taglinePtBrPendingRetry"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionEnPendingRetry"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionPtBrPendingRetry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing"
  ADD COLUMN "taglineEnPendingRetry"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taglinePtBrPendingRetry"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionEnPendingRetry"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "descriptionPtBrPendingRetry" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TranslationUsage" (
    "id"             TEXT    NOT NULL,
    "month"          TEXT    NOT NULL,
    "provider"       TEXT    NOT NULL DEFAULT 'deepl',
    "charactersUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationUsage_month_provider_key" ON "TranslationUsage"("month", "provider");
