CREATE TYPE "PaddleEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

CREATE TABLE "billing_checkout" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "environment" "PaddleEnvironment" NOT NULL,
  "plan" "BillingPlan" NOT NULL,
  "cycle" "BillingCycle" NOT NULL,
  "paddlePriceId" TEXT NOT NULL,
  "paddleTransactionId" TEXT NOT NULL,
  "expectedPaddleCustomerId" TEXT,
  "previousPaddleSubscriptionId" TEXT,
  "paddleSubscriptionId" TEXT,
  "boundAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_checkout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_checkout_binding_check"
    CHECK (("paddleSubscriptionId" IS NULL) = ("boundAt" IS NULL))
);

CREATE UNIQUE INDEX "billing_checkout_paddleTransactionId_key"
  ON "billing_checkout"("paddleTransactionId");
CREATE UNIQUE INDEX "billing_checkout_paddleSubscriptionId_key"
  ON "billing_checkout"("paddleSubscriptionId");
CREATE INDEX "billing_checkout_workspaceId_createdAt_idx"
  ON "billing_checkout"("workspaceId", "createdAt");
CREATE INDEX "billing_checkout_requestedByUserId_idx"
  ON "billing_checkout"("requestedByUserId");

ALTER TABLE "billing_checkout" ADD CONSTRAINT "billing_checkout_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_checkout" ADD CONSTRAINT "billing_checkout_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
