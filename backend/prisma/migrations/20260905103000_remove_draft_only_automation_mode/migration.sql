UPDATE "store_knowledge_profile"
SET "automationMode" = 'SHADOW'
WHERE "automationMode" = 'DRAFT_ONLY';

UPDATE "ai_draft_attempt"
SET "automationMode" = 'SHADOW'
WHERE "automationMode" = 'DRAFT_ONLY';

ALTER TABLE "store_knowledge_profile"
  ALTER COLUMN "automationMode" DROP DEFAULT;

ALTER TABLE "ai_draft_attempt"
  ALTER COLUMN "automationMode" DROP DEFAULT;

ALTER TYPE "AiAutomationMode" RENAME TO "AiAutomationMode_old";

CREATE TYPE "AiAutomationMode" AS ENUM ('OFF', 'SHADOW', 'SAFE_AUTO');

ALTER TABLE "store_knowledge_profile"
  ALTER COLUMN "automationMode" TYPE "AiAutomationMode"
  USING "automationMode"::text::"AiAutomationMode";

ALTER TABLE "ai_draft_attempt"
  ALTER COLUMN "automationMode" TYPE "AiAutomationMode"
  USING "automationMode"::text::"AiAutomationMode";

DROP TYPE "AiAutomationMode_old";

ALTER TABLE "store_knowledge_profile"
  ALTER COLUMN "automationMode" SET DEFAULT 'OFF';

ALTER TABLE "ai_draft_attempt"
  ALTER COLUMN "automationMode" SET DEFAULT 'OFF';
