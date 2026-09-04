DO $$
BEGIN
  CREATE TYPE "AiAutomationMode" AS ENUM ('OFF', 'DRAFT_ONLY', 'SAFE_AUTO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "store_knowledge_profile"
ADD COLUMN IF NOT EXISTS "automationMode" "AiAutomationMode" NOT NULL DEFAULT 'OFF';
