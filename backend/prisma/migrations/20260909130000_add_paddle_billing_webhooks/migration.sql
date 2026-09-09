ALTER TABLE "billing_subscription"
ADD COLUMN "paddleUpdatedAt" TIMESTAMP(3);

CREATE TABLE "billing_webhook_event" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_webhook_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_webhook_event_eventType_occurredAt_idx"
ON "billing_webhook_event"("eventType", "occurredAt");
