CREATE TYPE "SupportTicketCategory" AS ENUM (
  'CHANNELS',
  'AI_AUTOMATION',
  'CATALOG_INVENTORY',
  'BILLING_ACCOUNT',
  'TEAM_ACCESS',
  'OTHER'
);

CREATE TYPE "SupportTicketImpact" AS ENUM ('QUESTION', 'PARTIAL', 'BLOCKED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED'
);
CREATE TYPE "SupportMessageAuthorType" AS ENUM (
  'CUSTOMER',
  'SUPPORT',
  'SYSTEM'
);

CREATE TABLE "support_ticket" (
  "id" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "storeId" TEXT,
  "createdByUserId" TEXT,
  "category" "SupportTicketCategory" NOT NULL,
  "impact" "SupportTicketImpact" NOT NULL,
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "planSnapshot" "BillingPlan" NOT NULL,
  "context" JSONB,
  "firstResponseDueAt" TIMESTAMP(3) NOT NULL,
  "firstRespondedAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_message" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorType" "SupportMessageAuthorType" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_ticket_number_key" ON "support_ticket"("number");
CREATE INDEX "support_ticket_storeId_status_lastMessageAt_idx"
  ON "support_ticket"("storeId", "status", "lastMessageAt");
CREATE INDEX "support_ticket_workspaceId_status_lastMessageAt_idx"
  ON "support_ticket"("workspaceId", "status", "lastMessageAt");
CREATE INDEX "support_ticket_createdByUserId_lastMessageAt_idx"
  ON "support_ticket"("createdByUserId", "lastMessageAt");
CREATE INDEX "support_message_ticketId_createdAt_idx"
  ON "support_message"("ticketId", "createdAt");

ALTER TABLE "support_ticket"
  ADD CONSTRAINT "support_ticket_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket"
  ADD CONSTRAINT "support_ticket_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "store"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket"
  ADD CONSTRAINT "support_ticket_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_message"
  ADD CONSTRAINT "support_message_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_message"
  ADD CONSTRAINT "support_message_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
