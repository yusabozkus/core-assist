CREATE TABLE "billing_closure_record" (
  "id" TEXT NOT NULL,
  "workspaceReference" TEXT NOT NULL,
  "environment" "PaddleEnvironment" NOT NULL,
  "paddleSubscriptionIds" TEXT[] NOT NULL,
  "paddleCustomerIds" TEXT[] NOT NULL,
  "billingSnapshot" JSONB NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_closure_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_closure_record_workspaceReference_key"
  ON "billing_closure_record"("workspaceReference");
CREATE INDEX "billing_closure_record_paddleSubscriptionIds_idx"
  ON "billing_closure_record" USING GIN ("paddleSubscriptionIds");
