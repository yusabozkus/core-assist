-- Preserve each marketplace's inventory snapshot separately from the canonical variant.
CREATE TYPE "InventoryPolicy" AS ENUM ('SHARED', 'CHANNEL_SPECIFIC');

ALTER TABLE "store"
ADD COLUMN "inventoryPolicy" "InventoryPolicy";

ALTER TABLE "external_product_variant"
ADD COLUMN "price" DECIMAL(12, 2),
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

UPDATE "external_product_variant" AS external_variant
SET
  "price" = variant."price",
  "currency" = variant."currency",
  "stock" = variant."stock"
FROM "product_variant" AS variant
WHERE variant."id" = external_variant."productVariantId";

ALTER TABLE "external_product_variant"
ALTER COLUMN "price" SET NOT NULL;
