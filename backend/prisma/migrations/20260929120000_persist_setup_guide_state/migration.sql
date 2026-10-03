ALTER TABLE "store_member"
  ADD COLUMN "setupGuidePhase" TEXT NOT NULL DEFAULT 'ESSENTIAL',
  ADD COLUMN "setupGuideAiSettingsVisitedAt" TIMESTAMP(3),
  ADD COLUMN "setupGuideFaqSkippedAt" TIMESTAMP(3);

ALTER TABLE "store_member"
  ADD CONSTRAINT "store_member_setupGuidePhase_check"
  CHECK ("setupGuidePhase" IN ('ESSENTIAL', 'OPTIONAL', 'DONE'));
