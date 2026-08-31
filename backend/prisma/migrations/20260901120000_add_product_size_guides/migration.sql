-- CreateEnum
CREATE TYPE "SizeGuideStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "product_size_guide" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "externalProductId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "status" "SizeGuideStatus" NOT NULL DEFAULT 'PENDING',
    "rawText" TEXT,
    "normalizedText" TEXT,
    "structuredData" JSONB,
    "confidence" DOUBLE PRECISION,
    "failureReason" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_size_guide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_size_guide_externalProductId_key" ON "product_size_guide"("externalProductId");

-- CreateIndex
CREATE INDEX "product_size_guide_productId_status_idx" ON "product_size_guide"("productId", "status");

-- CreateIndex
CREATE INDEX "product_size_guide_sourceUrl_status_idx" ON "product_size_guide"("sourceUrl", "status");

-- AddForeignKey
ALTER TABLE "product_size_guide" ADD CONSTRAINT "product_size_guide_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_size_guide" ADD CONSTRAINT "product_size_guide_externalProductId_fkey" FOREIGN KEY ("externalProductId") REFERENCES "external_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
