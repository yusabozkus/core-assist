CREATE TABLE "billing_transaction_reference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "environment" "PaddleEnvironment" NOT NULL,
  "paddleTransactionId" TEXT NOT NULL,
  "paddleSubscriptionId" TEXT,
  "paddleCustomerId" TEXT,
  "origin" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_transaction_reference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_tx_ref_environment_transaction_key"
  ON "billing_transaction_reference"("environment", "paddleTransactionId");
CREATE INDEX "billing_transaction_reference_workspaceId_occurredAt_idx"
  ON "billing_transaction_reference"("workspaceId", "occurredAt");
CREATE INDEX "billing_tx_ref_environment_subscription_idx"
  ON "billing_transaction_reference"("environment", "paddleSubscriptionId");
CREATE INDEX "billing_transaction_reference_environment_paddleCustomerId_idx"
  ON "billing_transaction_reference"("environment", "paddleCustomerId");
CREATE INDEX "billing_transaction_reference_updatedAt_idx"
  ON "billing_transaction_reference"("updatedAt");

ALTER TABLE "billing_transaction_reference"
  ADD CONSTRAINT "billing_transaction_reference_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the already-known initial checkout transaction references.
INSERT INTO "billing_transaction_reference" (
  "id",
  "workspaceId",
  "environment",
  "paddleTransactionId",
  "paddleSubscriptionId",
  "paddleCustomerId",
  "occurredAt",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "workspaceId",
  "environment",
  "paddleTransactionId",
  "paddleSubscriptionId",
  "expectedPaddleCustomerId",
  "createdAt",
  "createdAt",
  "updatedAt"
FROM "billing_checkout"
WHERE "paddleTransactionId" IS NOT NULL
ON CONFLICT ("environment", "paddleTransactionId") DO NOTHING;
