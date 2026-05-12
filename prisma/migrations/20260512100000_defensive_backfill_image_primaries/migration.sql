-- v0.3-geo-c follow-up post-CodeRabbit: backfill defensivo de duplicates
-- de `isPrimary = true` por entity, ANTES de que el partial unique
-- constraint pueda hacer su trabajo.
--
-- La migración previa `20260511150000_add_partial_unique_constraints
-- _for_image_primary` crea índices UNIQUE WHERE isPrimary = true. En
-- nuestra DB local NO había duplicates al momento del deploy → no
-- rompió. PERO en otros entornos (preview futuro, staging, prod cuando
-- exista) si hubo race con auto-primary ANTES del partial unique
-- constraint, hay rows con 2+ primaries por entity y el
-- CREATE UNIQUE INDEX falla.
--
-- Este backfill es idempotente: si no hay duplicates, es un no-op.
-- Si hay, conserva el más antiguo como primary y demote el resto. La
-- elección "más antiguo" (`ORDER BY createdAt ASC, id ASC`) es:
-- - Determinista entre runs.
-- - Probable que sea el que el editor consideraba "principal"
--   (subida intencional como primera).
-- - Estable: el `id` (cuid) tie-breaker garantiza orden total aún
--   con `createdAt` empate.
--
-- Re-aplicar la migración previa post-este backfill es seguro: los
-- partial unique constraints ya están creados, no se re-aplican.

-- === Region ===
WITH ranked AS (
  SELECT id, "regionId",
         row_number() OVER (PARTITION BY "regionId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "RegionImage"
  WHERE "isPrimary" = true
)
UPDATE "RegionImage" t
SET "isPrimary" = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- === Province ===
WITH ranked AS (
  SELECT id, "provinceId",
         row_number() OVER (PARTITION BY "provinceId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "ProvinceImage"
  WHERE "isPrimary" = true
)
UPDATE "ProvinceImage" t
SET "isPrimary" = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- === Department ===
WITH ranked AS (
  SELECT id, "departmentId",
         row_number() OVER (PARTITION BY "departmentId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "DepartmentImage"
  WHERE "isPrimary" = true
)
UPDATE "DepartmentImage" t
SET "isPrimary" = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- === Locality ===
WITH ranked AS (
  SELECT id, "localityId",
         row_number() OVER (PARTITION BY "localityId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "LocalityImage"
  WHERE "isPrimary" = true
)
UPDATE "LocalityImage" t
SET "isPrimary" = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- === Listing ===
WITH ranked AS (
  SELECT id, "listingId",
         row_number() OVER (PARTITION BY "listingId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "ListingImage"
  WHERE "isPrimary" = true
)
UPDATE "ListingImage" t
SET "isPrimary" = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;
