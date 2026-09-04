CREATE TYPE "AiDraftTrigger" AS ENUM ('MANUAL', 'AUTOMATION');
CREATE TYPE "AiDraftOutcome" AS ENUM ('AVAILABLE', 'SUPERSEDED', 'SELECTED', 'SENT', 'FAILED');
CREATE TYPE "QuestionAnswerComposition" AS ENUM ('MANUAL', 'AI_UNCHANGED', 'AI_EDITED');

CREATE TABLE "ai_draft_attempt" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "trigger" "AiDraftTrigger" NOT NULL,
  "outcome" "AiDraftOutcome" NOT NULL DEFAULT 'AVAILABLE',
  "answer" TEXT NOT NULL,
  "decision" "QuestionReplyDecision" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "answerability" TEXT NOT NULL,
  "risks" JSONB NOT NULL,
  "missingInformation" JSONB NOT NULL,
  "evidenceIds" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "interpretation" TEXT,
  "requestedFacts" JSONB,
  "detectedFacts" JSONB,
  "selectedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_draft_attempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "question_answer"
  ADD COLUMN "draftAttemptId" TEXT,
  ADD COLUMN "composition" "QuestionAnswerComposition" NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX "question_answer_draftAttemptId_key"
  ON "question_answer"("draftAttemptId");
CREATE INDEX "ai_draft_attempt_questionId_createdAt_idx"
  ON "ai_draft_attempt"("questionId", "createdAt");
CREATE INDEX "ai_draft_attempt_storeId_outcome_createdAt_idx"
  ON "ai_draft_attempt"("storeId", "outcome", "createdAt");

ALTER TABLE "ai_draft_attempt"
  ADD CONSTRAINT "ai_draft_attempt_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_draft_attempt"
  ADD CONSTRAINT "ai_draft_attempt_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "product_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_draft_attempt"
  ADD CONSTRAINT "ai_draft_attempt_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_answer"
  ADD CONSTRAINT "question_answer_draftAttemptId_fkey"
  FOREIGN KEY ("draftAttemptId") REFERENCES "ai_draft_attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
