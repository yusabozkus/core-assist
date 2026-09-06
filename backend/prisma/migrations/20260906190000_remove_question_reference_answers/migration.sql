ALTER TABLE "product_question"
DROP COLUMN IF EXISTS "referenceAnswer",
DROP COLUMN IF EXISTS "referenceSourceUrl",
DROP COLUMN IF EXISTS "referenceSourceProvider";
