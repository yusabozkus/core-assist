CREATE TYPE "EmailProviderStatus" AS ENUM ('UNKNOWN', 'SENT', 'DELAYED', 'DELIVERED', 'FAILED', 'SUPPRESSED', 'BOUNCED', 'COMPLAINED');

CREATE TABLE "email_provider_message" (
  "id" TEXT NOT NULL,
  "status" "EmailProviderStatus" NOT NULL DEFAULT 'UNKNOWN',
  "statusAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_provider_message_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "email_delivery_event" (
  "id" VARCHAR(255) NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "status" "EmailProviderStatus" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_delivery_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_delivery_event_providerMessageId_fkey" FOREIGN KEY ("providerMessageId") REFERENCES "email_provider_message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "email_delivery_record" ADD COLUMN "workspaceId" TEXT, ADD COLUMN "emailType" VARCHAR(80);

INSERT INTO "email_provider_message" ("id")
SELECT DISTINCT "providerMessageId" FROM "email_delivery_record" WHERE "providerMessageId" IS NOT NULL;

UPDATE "email_delivery_record" AS e SET "workspaceId" = s."workspaceId"
FROM "store" AS s WHERE e."storeId" = s."id";
UPDATE "email_delivery_record" AS e SET "workspaceId" = i."workspaceId", "emailType" = 'TEAM_INVITATION'
FROM "workspace_invitation" AS i
WHERE e."deliveryKey" LIKE 'team-invite:%' AND split_part(e."deliveryKey", ':', 2) = i."id";
UPDATE "email_delivery_record" AS e SET "emailType" = n."type"::TEXT
FROM "notification" AS n
WHERE (e."deliveryKey" LIKE 'critical:%' OR e."deliveryKey" LIKE 'notification:%') AND split_part(e."deliveryKey", ':', 2) = n."id";
UPDATE "email_delivery_record" AS e SET "workspaceId" = w."id"
FROM "notification" AS n JOIN "workspace" AS w ON n."entityId" = w."id"
WHERE e."deliveryKey" = 'critical:' || n."id" AND n."entityType" = 'BILLING_WORKSPACE';

ALTER TABLE "email_delivery_record" ADD CONSTRAINT "email_delivery_record_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_delivery_record" ADD CONSTRAINT "email_delivery_record_providerMessageId_fkey" FOREIGN KEY ("providerMessageId") REFERENCES "email_provider_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "email_delivery_record_workspaceId_createdAt_idx" ON "email_delivery_record"("workspaceId", "createdAt");
CREATE INDEX "email_delivery_record_providerMessageId_idx" ON "email_delivery_record"("providerMessageId");
CREATE INDEX "email_provider_message_status_statusAt_idx" ON "email_provider_message"("status", "statusAt");
CREATE INDEX "email_provider_message_createdAt_idx" ON "email_provider_message"("createdAt");
CREATE INDEX "email_delivery_event_providerMessageId_occurredAt_idx" ON "email_delivery_event"("providerMessageId", "occurredAt");
CREATE INDEX "email_delivery_event_receivedAt_idx" ON "email_delivery_event"("receivedAt");
