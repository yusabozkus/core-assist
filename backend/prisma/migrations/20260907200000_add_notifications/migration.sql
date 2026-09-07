-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'AI_REVIEW_REQUIRED',
  'AI_DRAFT_FAILED',
  'ANSWER_DELIVERY_FAILED',
  'PRODUCT_SYNC_FAILED',
  'QUESTION_SYNC_FAILED',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'CHANNEL_CONNECTION_ERROR'
);

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "notification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "storeId" TEXT,
  "type" "NotificationType" NOT NULL,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "dedupeKey" TEXT,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "readAt" TIMESTAMP(3),
  "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipientUserId_dedupeKey_key"
ON "notification"("recipientUserId", "dedupeKey");

-- CreateIndex
CREATE INDEX "notification_recipientUserId_readAt_lastOccurredAt_idx"
ON "notification"("recipientUserId", "readAt", "lastOccurredAt");

-- CreateIndex
CREATE INDEX "notification_storeId_lastOccurredAt_idx"
ON "notification"("storeId", "lastOccurredAt");

-- AddForeignKey
ALTER TABLE "notification"
ADD CONSTRAINT "notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification"
ADD CONSTRAINT "notification_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "store"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
