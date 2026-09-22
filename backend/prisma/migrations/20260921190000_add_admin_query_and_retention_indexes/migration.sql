CREATE INDEX "billing_usage_event_metric_createdAt_idx"
ON "billing_usage_event"("metric", "createdAt");

CREATE INDEX "catalog_sync_run_status_startedAt_idx"
ON "catalog_sync_run"("status", "startedAt");

CREATE INDEX "catalog_sync_run_status_updatedAt_idx"
ON "catalog_sync_run"("status", "updatedAt");

CREATE INDEX "ai_draft_attempt_createdAt_idx"
ON "ai_draft_attempt"("createdAt");

CREATE INDEX "support_ticket_status_resolvedAt_idx"
ON "support_ticket"("status", "resolvedAt");

CREATE INDEX "support_ticket_status_closedAt_idx"
ON "support_ticket"("status", "closedAt");
