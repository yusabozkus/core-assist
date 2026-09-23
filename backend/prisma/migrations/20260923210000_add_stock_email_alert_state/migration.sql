CREATE TYPE "StockEmailAlertLevel" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK');

ALTER TABLE "external_product_variant"
  ADD COLUMN "stockEmailAlertLevel" "StockEmailAlertLevel",
  ADD COLUMN "stockEmailAlertStartedAt" TIMESTAMP(3);

UPDATE "external_product_variant"
SET "stockEmailAlertLevel" = CASE
  WHEN "stock" = 0 THEN 'OUT_OF_STOCK'::"StockEmailAlertLevel"
  WHEN "stock" BETWEEN 1 AND 5 THEN 'LOW_STOCK'::"StockEmailAlertLevel"
  ELSE NULL
END;

CREATE INDEX "external_product_variant_stockEmailAlertLevel_stockEmailAlertStartedAt_idx"
  ON "external_product_variant"("stockEmailAlertLevel", "stockEmailAlertStartedAt");
