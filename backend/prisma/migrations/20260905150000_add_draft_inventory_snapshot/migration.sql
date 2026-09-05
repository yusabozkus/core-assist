ALTER TABLE "ai_draft_attempt"
  ADD COLUMN IF NOT EXISTS "inventorySnapshotHash" TEXT;
