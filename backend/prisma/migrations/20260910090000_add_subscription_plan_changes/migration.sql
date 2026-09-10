ALTER TABLE "billing_subscription" ADD COLUMN "usagePeriodAnchor" TIMESTAMP(3);
UPDATE "billing_subscription" SET "usagePeriodAnchor" = "currentPeriodStart"
WHERE "paddleSubscriptionId" IS NOT NULL AND "status" <> 'TRIALING';

CREATE TYPE "BillingPlanChangeStatus" AS ENUM ('PREVIEWED', 'PROCESSING', 'AWAITING_WEBHOOK', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED');
CREATE TABLE "billing_plan_change" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "environment" "PaddleEnvironment" NOT NULL,
  "status" "BillingPlanChangeStatus" NOT NULL DEFAULT 'PREVIEWED',
  "paddleSubscriptionId" TEXT NOT NULL,
  "paddleCustomerId" TEXT NOT NULL,
  "sourcePriceId" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "targetPriceId" TEXT NOT NULL,
  "plan" "BillingPlan" NOT NULL,
  "cycle" "BillingCycle" NOT NULL,
  "preview" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_plan_change_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_plan_change_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_plan_change_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "billing_plan_change_workspaceId_createdAt_idx" ON "billing_plan_change"("workspaceId", "createdAt");
CREATE INDEX "billing_plan_change_requestedByUserId_idx" ON "billing_plan_change"("requestedByUserId");
CREATE UNIQUE INDEX "billing_plan_change_one_pending_per_workspace" ON "billing_plan_change"("workspaceId")
WHERE "status" IN ('PROCESSING', 'AWAITING_WEBHOOK', 'REVIEW_REQUIRED');
