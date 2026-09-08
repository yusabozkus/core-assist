-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('STARTER', 'GROWTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'PAUSED',
  'CANCELED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "BillingUsageMetric" AS ENUM ('AI_QUESTION');

-- CreateTable
CREATE TABLE "billing_subscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "plan" "BillingPlan" NOT NULL DEFAULT 'STARTER',
  "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "paddleCustomerId" TEXT,
  "paddleSubscriptionId" TEXT,
  "paddlePriceId" TEXT,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_subscription_period_check"
    CHECK ("currentPeriodEnd" > "currentPeriodStart")
);

-- CreateTable
CREATE TABLE "billing_usage_period" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "aiQuestionUnits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_usage_period_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_usage_period_range_check"
    CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "billing_usage_period_units_check"
    CHECK ("aiQuestionUnits" >= 0)
);

-- CreateTable
CREATE TABLE "billing_usage_event" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "usagePeriodId" TEXT NOT NULL,
  "metric" "BillingUsageMetric" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_usage_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_usage_event_quantity_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_workspaceId_key"
ON "billing_subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_paddleCustomerId_key"
ON "billing_subscription"("paddleCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_paddleSubscriptionId_key"
ON "billing_subscription"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "billing_subscription_status_currentPeriodEnd_idx"
ON "billing_subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_period_workspaceId_periodStart_key"
ON "billing_usage_period"("workspaceId", "periodStart");

-- CreateIndex
CREATE INDEX "billing_usage_period_workspaceId_periodEnd_idx"
ON "billing_usage_period"("workspaceId", "periodEnd");

-- CreateIndex
CREATE INDEX "billing_usage_period_subscriptionId_idx"
ON "billing_usage_period"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_event_workspaceId_idempotencyKey_key"
ON "billing_usage_event"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "billing_usage_event_usagePeriodId_metric_createdAt_idx"
ON "billing_usage_event"("usagePeriodId", "metric", "createdAt");

-- CreateIndex
CREATE INDEX "billing_usage_event_sourceType_sourceId_idx"
ON "billing_usage_event"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "billing_subscription"
ADD CONSTRAINT "billing_subscription_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_period"
ADD CONSTRAINT "billing_usage_period_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_period"
ADD CONSTRAINT "billing_usage_period_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_event"
ADD CONSTRAINT "billing_usage_event_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_event"
ADD CONSTRAINT "billing_usage_event_usagePeriodId_fkey"
FOREIGN KEY ("usagePeriodId") REFERENCES "billing_usage_period"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
