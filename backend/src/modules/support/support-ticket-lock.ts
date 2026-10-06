import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SupportTicketStatus } from '../../generated/prisma/enums';

export type LockedSupportTicket = {
  id: string;
  number: number;
  subject: string;
  createdAt: Date;
  status: SupportTicketStatus;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  assignedAdminUserId: string | null;
  workspaceId: string;
  storeId: string | null;
  createdByUserId: string | null;
};

/**
 * Serializes every state-changing operation for a support ticket.
 *
 * Call this as the first ticket read inside an interactive transaction, then
 * make status/assignment decisions only from the returned row. PostgreSQL
 * refreshes the locked row after a concurrent transaction commits, preventing
 * a stale snapshot from restoring an older ticket state.
 */
export async function lockSupportTicket(
  transaction: Prisma.TransactionClient,
  ticketId: string,
  storeId?: string,
) {
  const rows = storeId
    ? await transaction.$queryRaw<LockedSupportTicket[]>`
        SELECT
          "id",
          "number",
          "subject",
          "createdAt",
          "status",
          "firstRespondedAt",
          "resolvedAt",
          "closedAt",
          "assignedAdminUserId",
          "workspaceId",
          "storeId",
          "createdByUserId"
        FROM "support_ticket"
        WHERE "id" = ${ticketId} AND "storeId" = ${storeId}
        FOR UPDATE
      `
    : await transaction.$queryRaw<LockedSupportTicket[]>`
        SELECT
          "id",
          "number",
          "subject",
          "createdAt",
          "status",
          "firstRespondedAt",
          "resolvedAt",
          "closedAt",
          "assignedAdminUserId",
          "workspaceId",
          "storeId",
          "createdByUserId"
        FROM "support_ticket"
        WHERE "id" = ${ticketId}
        FOR UPDATE
      `;

  const ticket = rows[0];
  if (!ticket) throw new NotFoundException('Destek talebi bulunamadı.');
  return ticket;
}

/**
 * Every image writer locks referenced users, workspace, then ticket, matching
 * account deletion. Shared user locks also protect message/notification FKs.
 * NO KEY UPDATE allows unrelated ticket FK inserts, while serializing quota
 * checks and attachment inserts across all tickets belonging to this account.
 */
export async function lockSupportTicketForImages(
  transaction: Prisma.TransactionClient,
  ticketId: string,
  authorUserId: string,
  workspaceId?: string,
) {
  const scope = workspaceId
    ? Prisma.sql`AND workspace."id" = ${workspaceId}`
    : Prisma.empty;
  await transaction.$queryRaw(Prisma.sql`
    WITH target AS (
      SELECT workspace."ownerId", ticket."createdByUserId", ticket."assignedAdminUserId"
      FROM "workspace" AS workspace
      JOIN "support_ticket" AS ticket ON ticket."workspaceId" = workspace."id"
      WHERE ticket."id" = ${ticketId} ${scope}
    )
    SELECT person."id" FROM "user" AS person
    WHERE EXISTS (SELECT 1 FROM target)
      AND (person."id" = ${authorUserId} OR person."id" IN (
        SELECT "ownerId" FROM target
        UNION SELECT "createdByUserId" FROM target
        UNION SELECT "assignedAdminUserId" FROM target
      ))
    ORDER BY person."id"
    FOR KEY SHARE OF person
  `);
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT workspace."id"
    FROM "workspace" AS workspace
    JOIN "support_ticket" AS ticket ON ticket."workspaceId" = workspace."id"
    WHERE ticket."id" = ${ticketId} ${scope}
    FOR NO KEY UPDATE OF workspace
  `);
  const workspace = rows[0];
  if (!workspace) throw new NotFoundException('Destek talebi bulunamadı.');
  const ticket = await lockSupportTicket(transaction, ticketId);
  if (ticket.workspaceId !== workspace.id) {
    throw new NotFoundException('Destek talebi bulunamadı.');
  }
  return ticket;
}
