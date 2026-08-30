-- CreateEnum
CREATE TYPE "ProductVariantStatus" AS ENUM ('ACTIVE', 'OUT_OF_STOCK', 'UNAVAILABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExternalEntityStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CatalogSyncKind" AS ENUM ('FULL', 'INVENTORY');

-- AlterTable
ALTER TABLE "catalog_sync_run"
ADD COLUMN "kind" "CatalogSyncKind" NOT NULL DEFAULT 'FULL',
ADD COLUMN "productsArchived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "variantsProcessed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "channel_connection"
ADD COLUMN "lastInventorySyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "external_product"
ADD COLUMN "lastSeenSyncId" TEXT,
ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN "status" "ExternalEntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "product_variant"
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "external_product_variant" (
    "id" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "status" "ExternalEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenSyncId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_product_variant_productVariantId_idx" ON "external_product_variant"("productVariantId");

-- CreateIndex
CREATE INDEX "external_product_variant_barcode_idx" ON "external_product_variant"("barcode");

-- CreateIndex
CREATE INDEX "external_product_variant_sku_idx" ON "external_product_variant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "external_product_variant_externalProductId_externalId_key" ON "external_product_variant"("externalProductId", "externalId");

-- AddForeignKey
ALTER TABLE "external_product_variant" ADD CONSTRAINT "external_product_variant_externalProductId_fkey" FOREIGN KEY ("externalProductId") REFERENCES "external_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_product_variant" ADD CONSTRAINT "external_product_variant_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
