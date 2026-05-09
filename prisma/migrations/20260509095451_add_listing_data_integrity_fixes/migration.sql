-- DropIndex (single-column verifiedAt B-tree was sub-optimal for IS NULL/NOT NULL queries)
DROP INDEX "Listing_verifiedAt_idx";

-- CreateIndex (gestionado por Prisma — sort por defecto del listado admin)
CREATE INDEX "Listing_updatedAt_idx" ON "Listing"("updatedAt" DESC);

-- CreateIndex (partial — fichas pendientes de verificar; Prisma no expresa partial via @@index)
CREATE INDEX "Listing_unverified_idx" ON "Listing"("id") WHERE "verifiedAt" IS NULL;

-- CreateIndex (partial — fichas verificadas, ordenadas por recencia de verificacion)
CREATE INDEX "Listing_verified_recent_idx" ON "Listing"("verifiedAt" DESC) WHERE "verifiedAt" IS NOT NULL;

-- CreateIndex (partial unique — enforza la invariante "exactamente una categoria primaria por
-- listing" a nivel DB. Antes vivia solo en zod, vulnerable a race conditions y mutaciones SQL
-- directas. Prisma no expresa partial unique via @@unique.)
CREATE UNIQUE INDEX "ListingCategory_listingId_isPrimary_unique"
  ON "ListingCategory"("listingId")
  WHERE "isPrimary" = true;
