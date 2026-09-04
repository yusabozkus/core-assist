DO $$
BEGIN
  CREATE TYPE "CatalogSyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'RETRY', 'ONBOARDING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "CatalogSyncStage" AS ENUM ('QUEUED', 'FETCHING', 'PERSISTING', 'RECONCILING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "catalog_sync_run"
  ADD COLUMN IF NOT EXISTS "trigger" "CatalogSyncTrigger" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "stage" "CatalogSyncStage" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retryOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "productsCreated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "productsUpdated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "productsUnchanged" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "variantsUpdated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "variantsUnchanged" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "questionsUnchanged" INTEGER NOT NULL DEFAULT 0;

UPDATE "catalog_sync_run"
SET
  "stage" = CASE
    WHEN "status" = 'COMPLETED' THEN 'COMPLETED'::"CatalogSyncStage"
    WHEN "status" = 'FAILED' THEN 'FAILED'::"CatalogSyncStage"
    ELSE 'FETCHING'::"CatalogSyncStage"
  END,
  "progress" = CASE
    WHEN "status" IN ('COMPLETED', 'FAILED') THEN 100
    ELSE GREATEST("progress", 5)
  END;

CREATE INDEX IF NOT EXISTS "catalog_sync_run_retryOfId_idx"
  ON "catalog_sync_run"("retryOfId");
