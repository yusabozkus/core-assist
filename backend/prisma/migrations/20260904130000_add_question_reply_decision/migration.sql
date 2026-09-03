CREATE TYPE "QuestionReplyDecision" AS ENUM ('READY_FOR_SEND', 'NEEDS_REVIEW', 'DO_NOT_REPLY');

ALTER TABLE "product_question"
ADD COLUMN "draftDecision" "QuestionReplyDecision",
ADD COLUMN "draftConfidence" DOUBLE PRECISION,
ADD COLUMN "draftAnswerability" TEXT,
ADD COLUMN "draftRisks" JSONB,
ADD COLUMN "draftMissingInformation" JSONB,
ADD COLUMN "draftEvidenceIds" JSONB,
ADD COLUMN "draftModel" TEXT,
ADD COLUMN "draftedAt" TIMESTAMP(3);

CREATE INDEX "product_question_storeId_draftDecision_idx"
ON "product_question"("storeId", "draftDecision");
