ALTER TABLE "support_ticket"
  ADD COLUMN "assignedAdminUserId" TEXT;

ALTER TABLE "support_message"
  ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "support_ticket_assignedAdminUserId_status_lastMessageAt_idx"
  ON "support_ticket"("assignedAdminUserId", "status", "lastMessageAt");

CREATE INDEX "support_ticket_status_firstResponseDueAt_idx"
  ON "support_ticket"("status", "firstResponseDueAt");

CREATE INDEX "support_ticket_priority_status_lastMessageAt_idx"
  ON "support_ticket"("priority", "status", "lastMessageAt");

CREATE INDEX "support_message_ticketId_isInternal_createdAt_idx"
  ON "support_message"("ticketId", "isInternal", "createdAt");

ALTER TABLE "support_ticket"
  ADD CONSTRAINT "support_ticket_assignedAdminUserId_fkey"
  FOREIGN KEY ("assignedAdminUserId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
