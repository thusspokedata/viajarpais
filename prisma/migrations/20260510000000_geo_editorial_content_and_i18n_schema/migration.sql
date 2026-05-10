-- Migration: geo_editorial_content_and_i18n_schema
--
-- Schema editorial completo para los 4 niveles geograficos (Region, Province,
-- Department, Locality) + esqueleto i18n para Listing (DeepL llega en
-- v0.3-geo-b). Los renames de columnas existentes se hacen con
-- `RENAME COLUMN` para preservar contenido — Prisma por default genera
-- DROP+CREATE que perderia data.
--
-- Cambios principales:
-- 1. Nuevo enum `TranslationSource`.
-- 2. `Region.name` -> `nameEs` (rename); agregar `nameEn`/`namePtBr` con
--    backfill hardcoded para las 6 regiones.
-- 3. Campos editoriales (`tagline*`, `description*`, `metaTitle*`,
--    `metaDescription*`) + auditoria (`updatedAt`, `lastEditedById`) en los
--    4 niveles geograficos.
-- 4. `Listing`: rename `description`->`descriptionEs`, `metaTitle`->`metaTitleEs`,
--    `metaDescription`->`metaDescriptionEs`. Agregar campos i18n (En/PtBr) y
--    `tagline*`. Agregar `regionId` denormalizado con backfill desde la
--    cadena Locality -> Province -> regionId.
-- 5. 4 modelos de imagen: RegionImage, ProvinceImage, DepartmentImage,
--    LocalityImage. Cascade delete con su padre.

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('NONE', 'MACHINE', 'REVIEWED', 'HUMAN');

-- ============================================================
-- Region: rename name -> nameEs (preserva contenido), agregar nameEn/PtBr
-- con backfill hardcoded antes de marcarlas NOT NULL.
-- ============================================================
ALTER TABLE "Region" RENAME COLUMN "name" TO "nameEs";

ALTER TABLE "Region" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "Region" ADD COLUMN "namePtBr" TEXT;

UPDATE "Region" SET "nameEn" = 'Cuyo',                   "namePtBr" = 'Cuyo'                   WHERE "code" = 'cuyo';
UPDATE "Region" SET "nameEn" = 'Northwestern Argentina', "namePtBr" = 'Noroeste da Argentina'  WHERE "code" = 'noa';
UPDATE "Region" SET "nameEn" = 'Northeastern Argentina', "namePtBr" = 'Nordeste da Argentina'  WHERE "code" = 'nea';
UPDATE "Region" SET "nameEn" = 'Central Region',         "namePtBr" = 'Região Central'          WHERE "code" = 'centro';
UPDATE "Region" SET "nameEn" = 'Pampas Region',          "namePtBr" = 'Região Pampeana'         WHERE "code" = 'pampeana';
UPDATE "Region" SET "nameEn" = 'Patagonia',              "namePtBr" = 'Patagônia'               WHERE "code" = 'patagonia';

-- Defensivo: si en algun ambiente futuro hay regiones con codes distintos
-- de los 6 conocidos (drift, fork, error de seed manual), el `SET NOT NULL`
-- abajo abortaria la migracion. Usamos `nameEs` como fallback —
-- comportamiento detectable (queda nombre repetido en los 3 idiomas) sin
-- placeholder magico tipo 'TBD' que sea mas dificil de identificar.
UPDATE "Region" SET "nameEn"   = "nameEs" WHERE "nameEn"   IS NULL;
UPDATE "Region" SET "namePtBr" = "nameEs" WHERE "namePtBr" IS NULL;

ALTER TABLE "Region" ALTER COLUMN "nameEn" SET NOT NULL;
ALTER TABLE "Region" ALTER COLUMN "namePtBr" SET NOT NULL;

-- Region: campos editoriales + auditoria
ALTER TABLE "Region"
  ADD COLUMN "taglineEs"                   TEXT,
  ADD COLUMN "taglineEn"                   TEXT,
  ADD COLUMN "taglinePtBr"                 TEXT,
  ADD COLUMN "taglineEnSource"             "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglinePtBrSource"           "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglineEnTranslatedAt"       TIMESTAMP(3),
  ADD COLUMN "taglinePtBrTranslatedAt"     TIMESTAMP(3),
  ADD COLUMN "descriptionEs"               TEXT,
  ADD COLUMN "descriptionEn"               TEXT,
  ADD COLUMN "descriptionPtBr"             TEXT,
  ADD COLUMN "descriptionEnSource"         "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionPtBrSource"       "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionEnTranslatedAt"   TIMESTAMP(3),
  ADD COLUMN "descriptionPtBrTranslatedAt" TIMESTAMP(3),
  ADD COLUMN "metaTitleEs"                 TEXT,
  ADD COLUMN "metaTitleEn"                 TEXT,
  ADD COLUMN "metaTitlePtBr"               TEXT,
  ADD COLUMN "metaDescriptionEs"           TEXT,
  ADD COLUMN "metaDescriptionEn"           TEXT,
  ADD COLUMN "metaDescriptionPtBr"         TEXT,
  ADD COLUMN "lastEditedById"              TEXT,
  ADD COLUMN "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- Province: campos editoriales + auditoria
-- ============================================================
ALTER TABLE "Province"
  ADD COLUMN "taglineEs"                   TEXT,
  ADD COLUMN "taglineEn"                   TEXT,
  ADD COLUMN "taglinePtBr"                 TEXT,
  ADD COLUMN "taglineEnSource"             "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglinePtBrSource"           "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglineEnTranslatedAt"       TIMESTAMP(3),
  ADD COLUMN "taglinePtBrTranslatedAt"     TIMESTAMP(3),
  ADD COLUMN "descriptionEs"               TEXT,
  ADD COLUMN "descriptionEn"               TEXT,
  ADD COLUMN "descriptionPtBr"             TEXT,
  ADD COLUMN "descriptionEnSource"         "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionPtBrSource"       "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionEnTranslatedAt"   TIMESTAMP(3),
  ADD COLUMN "descriptionPtBrTranslatedAt" TIMESTAMP(3),
  ADD COLUMN "metaTitleEs"                 TEXT,
  ADD COLUMN "metaTitleEn"                 TEXT,
  ADD COLUMN "metaTitlePtBr"               TEXT,
  ADD COLUMN "metaDescriptionEs"           TEXT,
  ADD COLUMN "metaDescriptionEn"           TEXT,
  ADD COLUMN "metaDescriptionPtBr"         TEXT,
  ADD COLUMN "lastEditedById"              TEXT,
  ADD COLUMN "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- Department: campos editoriales + auditoria
-- ============================================================
ALTER TABLE "Department"
  ADD COLUMN "taglineEs"                   TEXT,
  ADD COLUMN "taglineEn"                   TEXT,
  ADD COLUMN "taglinePtBr"                 TEXT,
  ADD COLUMN "taglineEnSource"             "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglinePtBrSource"           "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglineEnTranslatedAt"       TIMESTAMP(3),
  ADD COLUMN "taglinePtBrTranslatedAt"     TIMESTAMP(3),
  ADD COLUMN "descriptionEs"               TEXT,
  ADD COLUMN "descriptionEn"               TEXT,
  ADD COLUMN "descriptionPtBr"             TEXT,
  ADD COLUMN "descriptionEnSource"         "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionPtBrSource"       "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionEnTranslatedAt"   TIMESTAMP(3),
  ADD COLUMN "descriptionPtBrTranslatedAt" TIMESTAMP(3),
  ADD COLUMN "metaTitleEs"                 TEXT,
  ADD COLUMN "metaTitleEn"                 TEXT,
  ADD COLUMN "metaTitlePtBr"               TEXT,
  ADD COLUMN "metaDescriptionEs"           TEXT,
  ADD COLUMN "metaDescriptionEn"           TEXT,
  ADD COLUMN "metaDescriptionPtBr"         TEXT,
  ADD COLUMN "lastEditedById"              TEXT,
  ADD COLUMN "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- Locality: campos editoriales + auditoria
-- ============================================================
ALTER TABLE "Locality"
  ADD COLUMN "taglineEs"                   TEXT,
  ADD COLUMN "taglineEn"                   TEXT,
  ADD COLUMN "taglinePtBr"                 TEXT,
  ADD COLUMN "taglineEnSource"             "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglinePtBrSource"           "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglineEnTranslatedAt"       TIMESTAMP(3),
  ADD COLUMN "taglinePtBrTranslatedAt"     TIMESTAMP(3),
  ADD COLUMN "descriptionEs"               TEXT,
  ADD COLUMN "descriptionEn"               TEXT,
  ADD COLUMN "descriptionPtBr"             TEXT,
  ADD COLUMN "descriptionEnSource"         "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionPtBrSource"       "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionEnTranslatedAt"   TIMESTAMP(3),
  ADD COLUMN "descriptionPtBrTranslatedAt" TIMESTAMP(3),
  ADD COLUMN "metaTitleEs"                 TEXT,
  ADD COLUMN "metaTitleEn"                 TEXT,
  ADD COLUMN "metaTitlePtBr"               TEXT,
  ADD COLUMN "metaDescriptionEs"           TEXT,
  ADD COLUMN "metaDescriptionEn"           TEXT,
  ADD COLUMN "metaDescriptionPtBr"         TEXT,
  ADD COLUMN "lastEditedById"              TEXT,
  ADD COLUMN "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- Listing: rename description/meta* -> *Es (preservar contenido)
-- ============================================================
ALTER TABLE "Listing" RENAME COLUMN "description"     TO "descriptionEs";
ALTER TABLE "Listing" RENAME COLUMN "metaTitle"       TO "metaTitleEs";
ALTER TABLE "Listing" RENAME COLUMN "metaDescription" TO "metaDescriptionEs";

-- Listing: campos i18n nuevos + tagline + regionId nullable inicial
ALTER TABLE "Listing"
  ADD COLUMN "taglineEs"                   TEXT,
  ADD COLUMN "taglineEn"                   TEXT,
  ADD COLUMN "taglinePtBr"                 TEXT,
  ADD COLUMN "taglineEnSource"             "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglinePtBrSource"           "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "taglineEnTranslatedAt"       TIMESTAMP(3),
  ADD COLUMN "taglinePtBrTranslatedAt"     TIMESTAMP(3),
  ADD COLUMN "descriptionEn"               TEXT,
  ADD COLUMN "descriptionPtBr"             TEXT,
  ADD COLUMN "descriptionEnSource"         "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionPtBrSource"       "TranslationSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "descriptionEnTranslatedAt"   TIMESTAMP(3),
  ADD COLUMN "descriptionPtBrTranslatedAt" TIMESTAMP(3),
  ADD COLUMN "metaTitleEn"                 TEXT,
  ADD COLUMN "metaTitlePtBr"               TEXT,
  ADD COLUMN "metaDescriptionEn"           TEXT,
  ADD COLUMN "metaDescriptionPtBr"         TEXT,
  ADD COLUMN "regionId"                    TEXT;

-- Backfill regionId para Listings existentes via cadena
-- Locality -> Province -> regionId. Si no hay Listings, este UPDATE
-- afecta 0 filas (no rompe).
UPDATE "Listing" l
  SET "regionId" = p."regionId"
  FROM "Locality" loc
  JOIN "Province" p ON p."id" = loc."provinceId"
  WHERE l."localityId" = loc."id"
    AND l."regionId" IS NULL;

ALTER TABLE "Listing" ALTER COLUMN "regionId" SET NOT NULL;

-- Listing indices nuevos
CREATE INDEX "Listing_regionId_idx"        ON "Listing"("regionId");
CREATE INDEX "Listing_regionId_status_idx" ON "Listing"("regionId", "status");

-- ============================================================
-- 4 modelos de imagen
-- ============================================================
CREATE TABLE "RegionImage" (
    "id"                 TEXT      NOT NULL,
    "regionId"           TEXT      NOT NULL,
    "cloudinaryPublicId" TEXT      NOT NULL,
    "url"                TEXT      NOT NULL,
    "caption"            TEXT,
    "altText"            TEXT,
    "order"              INTEGER   NOT NULL DEFAULT 0,
    "isPrimary"          BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegionImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProvinceImage" (
    "id"                 TEXT      NOT NULL,
    "provinceId"         TEXT      NOT NULL,
    "cloudinaryPublicId" TEXT      NOT NULL,
    "url"                TEXT      NOT NULL,
    "caption"            TEXT,
    "altText"            TEXT,
    "order"              INTEGER   NOT NULL DEFAULT 0,
    "isPrimary"          BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProvinceImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentImage" (
    "id"                 TEXT      NOT NULL,
    "departmentId"       TEXT      NOT NULL,
    "cloudinaryPublicId" TEXT      NOT NULL,
    "url"                TEXT      NOT NULL,
    "caption"            TEXT,
    "altText"            TEXT,
    "order"              INTEGER   NOT NULL DEFAULT 0,
    "isPrimary"          BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocalityImage" (
    "id"                 TEXT      NOT NULL,
    "localityId"         TEXT      NOT NULL,
    "cloudinaryPublicId" TEXT      NOT NULL,
    "url"                TEXT      NOT NULL,
    "caption"            TEXT,
    "altText"            TEXT,
    "order"              INTEGER   NOT NULL DEFAULT 0,
    "isPrimary"          BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocalityImage_pkey" PRIMARY KEY ("id")
);

-- Indices de imagen
CREATE UNIQUE INDEX "RegionImage_cloudinaryPublicId_key"     ON "RegionImage"("cloudinaryPublicId");
CREATE        INDEX "RegionImage_regionId_order_idx"         ON "RegionImage"("regionId", "order");
CREATE        INDEX "RegionImage_regionId_isPrimary_idx"     ON "RegionImage"("regionId", "isPrimary");

CREATE UNIQUE INDEX "ProvinceImage_cloudinaryPublicId_key"   ON "ProvinceImage"("cloudinaryPublicId");
CREATE        INDEX "ProvinceImage_provinceId_order_idx"     ON "ProvinceImage"("provinceId", "order");
CREATE        INDEX "ProvinceImage_provinceId_isPrimary_idx" ON "ProvinceImage"("provinceId", "isPrimary");

CREATE UNIQUE INDEX "DepartmentImage_cloudinaryPublicId_key"     ON "DepartmentImage"("cloudinaryPublicId");
CREATE        INDEX "DepartmentImage_departmentId_order_idx"     ON "DepartmentImage"("departmentId", "order");
CREATE        INDEX "DepartmentImage_departmentId_isPrimary_idx" ON "DepartmentImage"("departmentId", "isPrimary");

CREATE UNIQUE INDEX "LocalityImage_cloudinaryPublicId_key"     ON "LocalityImage"("cloudinaryPublicId");
CREATE        INDEX "LocalityImage_localityId_order_idx"       ON "LocalityImage"("localityId", "order");
CREATE        INDEX "LocalityImage_localityId_isPrimary_idx"   ON "LocalityImage"("localityId", "isPrimary");

-- ============================================================
-- Foreign keys
-- ============================================================
-- Listing -> Region
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- lastEditedById en los 4 niveles geo (Better Auth user table es lowercase)
ALTER TABLE "Region" ADD CONSTRAINT "Region_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Province" ADD CONSTRAINT "Province_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Cascade de imagenes con su padre geografico
ALTER TABLE "RegionImage" ADD CONSTRAINT "RegionImage_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProvinceImage" ADD CONSTRAINT "ProvinceImage_provinceId_fkey"
  FOREIGN KEY ("provinceId") REFERENCES "Province"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentImage" ADD CONSTRAINT "DepartmentImage_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityImage" ADD CONSTRAINT "LocalityImage_localityId_fkey"
  FOREIGN KEY ("localityId") REFERENCES "Locality"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
