-- CreateEnum
CREATE TYPE "ProductIdentityType" AS ENUM ('MODEL_CODE', 'GTIN');

-- CreateTable
CREATE TABLE "product_identity" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ProductIdentityType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_identity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_identity_storeId_type_value_key" ON "product_identity"("storeId", "type", "value");

-- CreateIndex
CREATE INDEX "product_identity_productId_idx" ON "product_identity"("productId");

-- AddForeignKey
ALTER TABLE "product_identity" ADD CONSTRAINT "product_identity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_identity" ADD CONSTRAINT "product_identity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace the canonical-product SKU constraint with a lookup index. The same
-- seller SKU can exist independently on more than one marketplace listing.
DROP INDEX "product_variant_productId_sku_key";
CREATE INDEX "product_variant_productId_sku_idx" ON "product_variant"("productId", "sku");
