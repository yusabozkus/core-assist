import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  NotificationSeverity,
  NotificationType,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { configuredAdminEmails } from '../admin/admin-access.policy';
import { NotificationsService } from '../notifications/notifications.service';

type TicketNotificationContext = {
  id: string;
  number: number;
  subject: string;
  createdAt: Date;
  storeId: string | null;
  createdByUserId: string | null;
  assignedAdminUserId: string | null;
};

const ACTIVE_SUPPORT_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING_CUSTOMER,
];

@Injectable()
export class SupportNotificationService {
  private readonly logger = new Logger(SupportNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyNewTicket(
    transaction: Prisma.TransactionClient,
    ticket: TicketNotificationContext,
  ) {
    const recipients = await this.getSupportAdminIds(transaction);
    return this.notifications.createForUsersInTransaction(transaction, {
      recipientUserIds: recipients,
      storeId: null,
      type: NotificationType.SUPPORT_NEW_TICKET,
      severity: NotificationSeverity.INFO,
      title: 'Yeni destek talebi',
      message: `${ticketCode(ticket)} · ${ticket.subject}`,
      actionUrl: `/admin/support/${ticket.id}`,
      entityType: 'SUPPORT_TICKET',
      entityId: ticket.id,
      dedupeKey: `support-new-ticket:${ticket.id}`,
    });
  }

  async notifyCustomerMessage(
    transaction: Prisma.TransactionClient,
    ticket: TicketNotificationContext,
    messageId: string,
  ) {
    const adminIds = await this.getSupportAdminIds(transaction);
    const recipients =
      ticket.assignedAdminUserId &&
      adminIds.includes(ticket.assignedAdminUserId)
        ? [ticket.assignedAdminUserId]
        : adminIds;

    return this.notifications.createForUsersInTransaction(transaction, {
      recipientUserIds: recipients,
      storeId: null,
      type: NotificationType.SUPPORT_CUSTOMER_MESSAGE,
      severity: NotificationSeverity.INFO,
      title: 'Destek talebine yeni mesaj',
      message: `${ticketCode(ticket)} · ${ticket.subject}`,
      actionUrl: `/admin/support/${ticket.id}`,
      entityType: 'SUPPORT_MESSAGE',
      entityId: messageId,
      dedupeKey: `support-customer-message:${messageId}`,
    });
  }

  async notifyAdminReply(
    transaction: Prisma.TransactionClient,
    ticket: TicketNotificationContext,
    messageId: string,
  ) {
    if (!ticket.createdByUserId) return [];

    return this.notifications.createForUsersInTransaction(transaction, {
      recipientUserIds: [ticket.createdByUserId],
      storeId: ticket.storeId,
      type: NotificationType.SUPPORT_ADMIN_REPLY,
      severity: NotificationSeverity.INFO,
      title: 'Destek ekibinden yeni yanıt',
      message: `${ticketCode(ticket)} numaralı talebiniz yanıtlandı.`,
      actionUrl: `/dashboard/support/tickets/${ticket.id}`,
      entityType: 'SUPPORT_MESSAGE',
      entityId: messageId,
      dedupeKey: `support-admin-reply:${messageId}`,
    });
  }

  async notifyAssigneeChanged(
    transaction: Prisma.TransactionClient,
    ticket: TicketNotificationContext,
    assigneeUserId: string | null,
    assignmentMessageId: string,
  ) {
    if (!assigneeUserId) return [];

    return this.notifications.createForUsersInTransaction(transaction, {
      recipientUserIds: [assigneeUserId],
      storeId: null,
      type: NotificationType.SUPPORT_ASSIGNMENT_CHANGED,
      severity: NotificationSeverity.INFO,
      title: 'Bir destek talebi size atandı',
      message: `${ticketCode(ticket)} · ${ticket.subject}`,
      actionUrl: `/admin/support/${ticket.id}`,
      entityType: 'SUPPORT_TICKET',
      entityId: ticket.id,
      dedupeKey: `support-assigned:${assignmentMessageId}`,
    });
  }

  async resolveSlaNotification(
    transaction: Prisma.TransactionClient,
    ticketId: string,
  ) {
    const unresolved = await transaction.notification.findMany({
      where: {
        type: NotificationType.SUPPORT_SLA_BREACHED,
        entityType: 'SUPPORT_TICKET',
        entityId: ticketId,
        readAt: null,
      },
      select: { recipientUserId: true },
    });
    if (unresolved.length === 0) return [];

    const updated = await transaction.notification.updateMany({
      where: {
        type: NotificationType.SUPPORT_SLA_BREACHED,
        entityType: 'SUPPORT_TICKET',
        entityId: ticketId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return updated.count > 0
      ? [...new Set(unresolved.map((item) => item.recipientUserId))]
      : [];
  }

  async notifyOverdueTickets() {
    const adminIds = await this.getSupportAdminIds(this.prisma);
    if (adminIds.length === 0) return 0;

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        status: { in: ACTIVE_SUPPORT_STATUSES },
        firstRespondedAt: null,
        firstResponseDueAt: { lt: new Date() },
      },
      select: {
        id: true,
        number: true,
        subject: true,
        createdAt: true,
      },
      orderBy: { firstResponseDueAt: 'asc' },
      take: 500,
    });
    if (tickets.length === 0) return 0;

    const dedupeKeys = tickets.map(
      (ticket) => `support-sla-breached:${ticket.id}`,
    );
    const existing = await this.prisma.notification.findMany({
      where: {
        recipientUserId: { in: adminIds },
        dedupeKey: { in: dedupeKeys },
      },
      select: { recipientUserId: true, dedupeKey: true },
    });
    const existingPairs = new Set(
      existing.map(
        (notification) =>
          `${notification.recipientUserId}:${notification.dedupeKey}`,
      ),
    );
    const notifications = tickets.flatMap((ticket) =>
      adminIds
        .filter(
          (recipientUserId) =>
            !existingPairs.has(
              `${recipientUserId}:support-sla-breached:${ticket.id}`,
            ),
        )
        .map((recipientUserId) => ({
          recipientUserId,
          storeId: null,
          type: NotificationType.SUPPORT_SLA_BREACHED,
          severity: NotificationSeverity.ERROR,
          title: 'Destek yanıt hedefi aşıldı',
          message: `${ticketCode(ticket)} · ${ticket.subject}`,
          actionUrl: `/admin/support/${ticket.id}`,
          entityType: 'SUPPORT_TICKET',
          entityId: ticket.id,
          dedupeKey: `support-sla-breached:${ticket.id}`,
        })),
    );
    if (notifications.length === 0) return 0;

    const result = await this.prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    });

    if (result.count > 0) {
      this.emitCreated(
        [...new Set(notifications.map((item) => item.recipientUserId))],
        null,
      );
      this.logger.warn(
        `${result.count} gecikmiş destek bildirimi oluşturuldu.`,
      );
    }
    return result.count;
  }

  emitCreated(recipientUserIds: string[], storeId: string | null) {
    this.notifications.emitChange(recipientUserIds, storeId, 'CREATED');
  }

  emitRead(recipientUserIds: string[]) {
    this.notifications.emitChange(recipientUserIds, null, 'READ');
  }

  private async getSupportAdminIds(
    client: Pick<Prisma.TransactionClient, 'user'>,
  ) {
    const emails = configuredAdminEmails();
    if (emails.size === 0) return [];

    const admins = await client.user.findMany({
      where: {
        emailVerified: true,
        OR: [...emails].map((email) => ({
          email: { equals: email, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });
    return admins.map((admin) => admin.id);
  }
}

function ticketCode(ticket: { number: number; createdAt: Date }) {
  return `CA-${ticket.createdAt.getUTCFullYear()}-${String(ticket.number).padStart(6, '0')}`;
}
