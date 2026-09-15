CREATE TYPE "ProductKnowledgeFactType" AS ENUM (
    'MATERIAL',
    'DURABILITY',
    'SIZE',
    'COLOR',
    'FIT',
    'CARE',
    'PRODUCT_INFO'
);

CREATE TYPE "ProductKnowledgeFactStatus" AS ENUM (
    'VERIFIED',
    'CONFLICT',
    'ARCHIVED'
);

CREATE TABLE "product_knowledge_fact" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "factType" "ProductKnowledgeFactType" NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" "ProductKnowledgeFactStatus" NOT NULL DEFAULT 'VERIFIED',
    "verifiedByUserId" TEXT,
    "originatingQuestionId" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_knowledge_fact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_knowledge_fact_productId_scopeKey_normalizedKey_key"
ON "product_knowledge_fact"("productId", "scopeKey", "normalizedKey");

CREATE INDEX "product_knowledge_fact_storeId_status_updatedAt_idx"
ON "product_knowledge_fact"("storeId", "status", "updatedAt");

CREATE INDEX "product_knowledge_fact_productId_status_idx"
ON "product_knowledge_fact"("productId", "status");

CREATE INDEX "product_knowledge_fact_variantId_status_idx"
ON "product_knowledge_fact"("variantId", "status");

ALTER TABLE "product_knowledge_fact"
ADD CONSTRAINT "product_knowledge_fact_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_knowledge_fact"
ADD CONSTRAINT "product_knowledge_fact_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_knowledge_fact"
ADD CONSTRAINT "product_knowledge_fact_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_knowledge_fact"
ADD CONSTRAINT "product_knowledge_fact_verifiedByUserId_fkey"
FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_knowledge_fact"
ADD CONSTRAINT "product_knowledge_fact_originatingQuestionId_fkey"
FOREIGN KEY ("originatingQuestionId") REFERENCES "product_question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
