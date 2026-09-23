CREATE TABLE "notification_email_digest_state" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "lastIncludedAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "pendingUntil" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_email_digest_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_email_digest_state_recipientUserId_storeId_type_key"
  ON "notification_email_digest_state"("recipientUserId", "storeId", "type");
CREATE INDEX "notification_email_digest_state_storeId_type_idx"
  ON "notification_email_digest_state"("storeId", "type");

ALTER TABLE "notification_email_digest_state"
  ADD CONSTRAINT "notification_email_digest_state_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_email_digest_state"
  ADD CONSTRAINT "notification_email_digest_state_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
