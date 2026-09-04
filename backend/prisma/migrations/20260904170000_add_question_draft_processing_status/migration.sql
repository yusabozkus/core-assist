DO $$
BEGIN
  CREATE TYPE "QuestionDraftProcessingStatus" AS ENUM ('QUEUED', 'PROCESSING', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "product_question"
  ADD COLUMN IF NOT EXISTS "draftProcessingStatus" "QuestionDraftProcessingStatus",
  ADD COLUMN IF NOT EXISTS "draftProcessingError" TEXT,
  ADD COLUMN IF NOT EXISTS "draftQueuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "draftProcessingStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "product_question_storeId_draftProcessingStatus_idx"
  ON "product_question"("storeId", "draftProcessingStatus");
