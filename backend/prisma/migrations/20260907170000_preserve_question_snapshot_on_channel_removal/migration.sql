-- AlterTable
ALTER TABLE "channel_connection" ADD COLUMN "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_question"
ADD COLUMN "productTitleSnapshot" TEXT,
ADD COLUMN "productImageUrlSnapshot" TEXT;

-- Backfill snapshots for existing question history.
UPDATE "product_question" AS question
SET
    "productTitleSnapshot" = product."title",
    "productImageUrlSnapshot" = (
        SELECT image."url"
        FROM "product_image" AS image
        WHERE image."productId" = product."id"
        ORDER BY image."position" ASC, image."createdAt" ASC
        LIMIT 1
    )
FROM "product" AS product
WHERE question."productId" = product."id";

-- CreateIndex
CREATE INDEX "channel_connection_storeId_removedAt_idx" ON "channel_connection"("storeId", "removedAt");
