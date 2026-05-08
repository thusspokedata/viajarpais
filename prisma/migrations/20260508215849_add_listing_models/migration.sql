-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingTier" AS ENUM ('FREE', 'PAID', 'FEATURED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NONE', 'ACTIVE', 'LAPSED');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('BUDGET', 'MID', 'HIGH', 'LUXURY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MERCADO_PAGO', 'TRANSFER', 'CRYPTO');

-- CreateEnum
CREATE TYPE "SpokenLanguage" AS ENUM ('ES', 'EN', 'PT', 'FR', 'DE', 'IT');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "priceRange" "PriceRange",
    "openingHours" JSONB,
    "paymentMethods" "PaymentMethod"[],
    "languages" "SpokenLanguage"[],
    "attributes" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "tier" "ListingTier" NOT NULL DEFAULT 'FREE',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE',
    "verifiedAt" TIMESTAMP(3),
    "verifiedUntil" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdById" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingCategory" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ListingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "altText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_provinceId_idx" ON "Listing"("provinceId");

-- CreateIndex
CREATE INDEX "Listing_departmentId_idx" ON "Listing"("departmentId");

-- CreateIndex
CREATE INDEX "Listing_localityId_idx" ON "Listing"("localityId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_tier_idx" ON "Listing"("tier");

-- CreateIndex
CREATE INDEX "Listing_verifiedAt_idx" ON "Listing"("verifiedAt");

-- CreateIndex
CREATE INDEX "ListingCategory_categoryId_idx" ON "ListingCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ListingCategory_listingId_isPrimary_idx" ON "ListingCategory"("listingId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ListingCategory_listingId_categoryId_key" ON "ListingCategory"("listingId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_cloudinaryPublicId_key" ON "ListingImage"("cloudinaryPublicId");

-- CreateIndex
CREATE INDEX "ListingImage_listingId_order_idx" ON "ListingImage"("listingId", "order");

-- CreateIndex
CREATE INDEX "ListingImage_listingId_isPrimary_idx" ON "ListingImage"("listingId", "isPrimary");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCategory" ADD CONSTRAINT "ListingCategory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCategory" ADD CONSTRAINT "ListingCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
