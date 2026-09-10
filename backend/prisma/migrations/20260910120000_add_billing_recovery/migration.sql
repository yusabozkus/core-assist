ALTER TABLE "billing_subscription"
  ADD COLUMN "paddleSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "scheduledAccessEndsAt" TIMESTAMP(3),
  ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconcileAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reconcileFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconcileErrorCode" TEXT;
CREATE INDEX "billing_subscription_reconcileAfter_idx" ON "billing_subscription"("reconcileAfter");
ALTER TYPE "QuestionDraftProcessingStatus" ADD VALUE 'BLOCKED_QUOTA';
ALTER TYPE "QuestionDraftProcessingStatus" ADD VALUE 'BLOCKED_SUBSCRIPTION';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_PAYMENT_ISSUE';
