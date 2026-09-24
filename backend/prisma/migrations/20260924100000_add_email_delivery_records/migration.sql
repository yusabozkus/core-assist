CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'REVIEW_REQUIRED');

CREATE TABLE "email_delivery_record" (
  "id" TEXT NOT NULL,
  "deliveryKey" VARCHAR(256) NOT NULL,
  "recipientEmail" VARCHAR(320) NOT NULL,
  "senderEmail" VARCHAR(320) NOT NULL,
  "subject" VARCHAR(500) NOT NULL,
  "html" TEXT,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "firstAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_delivery_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_delivery_record_deliveryKey_key" ON "email_delivery_record"("deliveryKey");
CREATE INDEX "email_delivery_record_status_nextAttemptAt_idx" ON "email_delivery_record"("status", "nextAttemptAt");
CREATE INDEX "email_delivery_record_status_claimUntil_idx" ON "email_delivery_record"("status", "claimUntil");
CREATE INDEX "email_delivery_record_createdAt_idx" ON "email_delivery_record"("createdAt");
