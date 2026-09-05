ALTER TYPE "AiAutomationMode" ADD VALUE 'SHADOW';

ALTER TABLE "store_knowledge_profile"
  ADD COLUMN "minimumAutoSendConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85;

ALTER TABLE "ai_draft_attempt"
  ADD COLUMN "automationMode" "AiAutomationMode" NOT NULL DEFAULT 'OFF',
  ADD COLUMN "autoSendEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appliedConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  ADD COLUMN "eligibilityReasons" JSONB NOT NULL DEFAULT '[]';
