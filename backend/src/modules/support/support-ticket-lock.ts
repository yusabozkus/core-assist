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
