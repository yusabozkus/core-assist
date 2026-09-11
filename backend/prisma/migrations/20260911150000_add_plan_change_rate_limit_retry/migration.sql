ALTER TYPE "BillingPlanChangeStatus" ADD VALUE 'RETRY_SCHEDULED';

ALTER TABLE "billing_plan_change"
  ADD COLUMN "retryAfterSeconds" INTEGER,
  ADD COLUMN "retryAt" TIMESTAMP(3),
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "billing_plan_change_one_pending_per_workspace";
CREATE UNIQUE INDEX "billing_plan_change_one_pending_per_workspace"
ON "billing_plan_change"("workspaceId")
WHERE "status" IN (
  'PROCESSING',
  'RETRY_SCHEDULED',
  'AWAITING_WEBHOOK',
  'REVIEW_REQUIRED'
);

CREATE INDEX "billing_plan_change_status_retryAt_idx"
ON "billing_plan_change"("status", "retryAt");
