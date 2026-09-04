DO $$
BEGIN
  CREATE TYPE "QuestionAnswerOrigin" AS ENUM ('MANUAL', 'AUTOMATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "question_answer"
ADD COLUMN IF NOT EXISTS "origin" "QuestionAnswerOrigin" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "question_answer"
ALTER COLUMN "requestedByUserId" DROP NOT NULL;

ALTER TABLE "question_answer"
DROP CONSTRAINT IF EXISTS "question_answer_requestedByUserId_fkey";

ALTER TABLE "question_answer"
ADD CONSTRAINT "question_answer_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
