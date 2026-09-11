CREATE INDEX "billing_webhook_event_processedAt_idx"
ON "billing_webhook_event"("processedAt");

CREATE INDEX "billing_checkout_status_updatedAt_idx"
ON "billing_checkout"("status", "updatedAt");

CREATE INDEX "billing_plan_change_status_expiresAt_idx"
ON "billing_plan_change"("status", "expiresAt");

CREATE INDEX "billing_plan_change_status_updatedAt_idx"
ON "billing_plan_change"("status", "updatedAt");
