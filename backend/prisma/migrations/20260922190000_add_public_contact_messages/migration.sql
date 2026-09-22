CREATE TYPE "ContactMessageTopic" AS ENUM (
  'PRODUCT',
  'PRICING',
  'PARTNERSHIP',
  'OTHER'
);

CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

CREATE TABLE "contact_message" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "company" TEXT,
  "topic" "ContactMessageTopic" NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
  "requestFingerprint" TEXT NOT NULL,
  "sourcePage" TEXT,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_message_status_createdAt_idx"
  ON "contact_message"("status", "createdAt");
CREATE INDEX "contact_message_topic_createdAt_idx"
  ON "contact_message"("topic", "createdAt");
CREATE INDEX "contact_message_emailNormalized_createdAt_idx"
  ON "contact_message"("emailNormalized", "createdAt");
CREATE INDEX "contact_message_requestFingerprint_createdAt_idx"
  ON "contact_message"("requestFingerprint", "createdAt");
CREATE INDEX "contact_message_archivedAt_idx"
  ON "contact_message"("archivedAt");
