BEGIN;

CREATE TYPE "BillingCheckoutStatus" AS ENUM (
  'CREATING', 'OPEN', 'REVIEW_REQUIRED', 'COMPLETED', 'CANCELED', 'FAILED'
);

ALTER TABLE "billing_checkout"
  ADD COLUMN "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'CREATING',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "paddleTransactionId" DROP NOT NULL;

UPDATE "billing_checkout"
SET "status" = CASE WHEN "boundAt" IS NOT NULL
  THEN 'COMPLETED'::"BillingCheckoutStatus"
  ELSE 'OPEN'::"BillingCheckoutStatus" END;

-- Do not discard possibly payable legacy checkouts or pick an arbitrary winner.
-- Resolve any pre-existing duplicates with Paddle before deploying this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "billing_checkout" WHERE "status" = 'OPEN'
    GROUP BY "workspaceId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple unresolved billing checkouts exist for a workspace; reconcile them with Paddle before migrating.';
  END IF;
END $$;

CREATE UNIQUE INDEX "billing_checkout_one_pending_per_workspace"
ON "billing_checkout" ("workspaceId")
WHERE "status" IN ('CREATING', 'OPEN', 'REVIEW_REQUIRED');

ALTER TABLE "billing_checkout" ADD CONSTRAINT "billing_checkout_transaction_required"
CHECK ("status" NOT IN ('OPEN', 'COMPLETED', 'CANCELED') OR "paddleTransactionId" IS NOT NULL);

COMMIT;
