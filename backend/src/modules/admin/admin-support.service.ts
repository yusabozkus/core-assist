import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  SupportMessageAuthorType,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import { SupportNotificationService } from '../support/support-notification.service';
import { lockSupportTicket } from '../support/support-ticket-lock';
import { AdminAccessService } from './admin-access.service';
import { AdminSupportAssigneeDto } from './dto/admin-support-assignee.dto';
import {
  AdminSupportMessageDto,
  AdminSupportMessageVisibility,
} from './dto/admin-support-message.dto';
import { AdminSupportStatusDto } from './dto/admin-support-status.dto';
import {
  AdminSupportAssigneeFilter,
  AdminSupportSort,
  AdminSupportTicketsQueryDto,
} from './dto/admin-support-tickets-query.dto';

const ACTIVE_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING_CUSTOMER,
];

const personSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const adminTicketListInclude = {
  workspace: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
  createdBy: { select: personSelect },
  assignedAdmin: { select: personSelect },
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: {
      body: true,
      authorType: true,
      isInternal: true,
      createdAt: true,
    },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

const adminTicketDetailInclude = {
  workspace: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
  createdBy: { select: personSelect },
  assignedAdmin: { select: personSelect },
  messages: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { author: { select: personSelect } },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

type AdminTicketListRecord = Prisma.SupportTicketGetPayload<{
  include: typeof adminTicketListInclude;
}>;

type AdminTicketDetailRecord = Prisma.SupportTicketGetPayload<{
  include: typeof adminTicketDetailInclude;
}>;

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAccess: AdminAccessService,
    private readonly audit: AuditLogService,
    private readonly supportNotifications: SupportNotificationService,
  ) {}

  async findAll(query: AdminSupportTicketsQueryDto, currentAdminId: string) {
    const where = this.buildWhere(query, currentAdminId);
    const now = new Date();
    const activeWhere = { status: { in: ACTIVE_STATUSES } };

    const [tickets, total, active, unassigned, urgent, overdue] =
      await Promise.all([
        this.prisma.supportTicket.findMany({
          where,
          include: adminTicketListInclude,
          orderBy: this.resolveOrderBy(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.supportTicket.count({ where }),
        this.prisma.supportTicket.count({ where: activeWhere }),
        this.prisma.supportTicket.count({
          where: { ...activeWhere, assignedAdminUserId: null },
        }),
        this.prisma.supportTicket.count({
          where: { ...activeWhere, priority: 'URGENT' },
        }),
        this.prisma.supportTicket.count({
          where: {
            ...activeWhere,
            firstRespondedAt: null,
            firstResponseDueAt: { lt: now },
          },
        }),
      ]);

    return {
      items: tickets.map((ticket) => this.toSummary(ticket)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: { active, unassigned, urgent, overdue },
    };
  }

  async findOne(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: adminTicketDetailInclude,
    });
    if (!ticket) throw new NotFoundException('Destek talebi bulunamadı.');
    return this.toDetail(ticket);
  }

  async getAgents() {
    const allowedEmails = this.adminAccess.getAllowedEmailAddresses();
    if (!allowedEmails.length) return [];

    return this.prisma.user.findMany({
      where: {
        emailVerified: true,
        OR: allowedEmails.map((email) => ({
          email: { equals: email, mode: 'insensitive' as const },
        })),
      },
      select: personSelect,
      orderBy: { name: 'asc' },
    });
  }

  async addMessage(
    ticketId: string,
    adminUserId: string,
    body: AdminSupportMessageDto,
  ) {
    const isInternal =
      body.visibility === AdminSupportMessageVisibility.INTERNAL;

    const result = await this.prisma.$transaction(async (transaction) => {
      const ticket = await lockSupportTicket(transaction, ticketId);
      if (
        !isInternal &&
        (ticket.status === SupportTicketStatus.RESOLVED ||
          ticket.status === SupportTicketStatus.CLOSED)
      ) {
        throw new BadRequestException(
          'Kullanıcıya yanıt vermeden önce talebi yeniden açmalısınız.',
        );
      }

      const now = new Date();
      const message = await transaction.supportMessage.create({
        data: {
          ticketId,
          authorUserId: adminUserId,
          authorType: SupportMessageAuthorType.SUPPORT,
          isInternal,
          body: body.message,
        },
      });
      await transaction.supportTicket.update({
        where: { id: ticketId },
        data: isInternal
          ? { updatedAt: now }
          : {
              status: SupportTicketStatus.WAITING_CUSTOMER,
              firstRespondedAt: ticket.firstRespondedAt ?? now,
              lastMessageAt: now,
              resolvedAt: null,
              closedAt: null,
            },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUserId,
          origin: AuditOrigin.API,
          action: isInternal
            ? AuditAction.ADMIN_SUPPORT_INTERNAL_NOTE_ADDED
            : AuditAction.ADMIN_SUPPORT_REPLY_ADDED,
          result: AuditResult.SUCCESS,
          workspaceId: ticket.workspaceId,
          storeId: ticket.storeId,
          targetType: 'SUPPORT_TICKET',
          targetId: ticketId,
          before: { status: ticket.status },
          after: {
            status: isInternal
              ? ticket.status
              : SupportTicketStatus.WAITING_CUSTOMER,
          },
          metadata: {
            visibility: body.visibility,
            messageLength: body.message.length,
          },
        },
        transaction,
      );
      if (isInternal) {
        return {
          ticket,
          created: [] as string[],
          resolved: [] as string[],
        };
      }

      const created = await this.supportNotifications.notifyAdminReply(
        transaction,
        ticket,
        message.id,
      );
      const resolved = await this.supportNotifications.resolveSlaNotification(
        transaction,
        ticket.id,
      );
      return { ticket, created, resolved };
    });

    this.supportNotifications.emitCreated(
      result.created,
      result.ticket.storeId,
    );
    this.supportNotifications.emitRead(result.resolved);

    return this.findOne(ticketId);
  }

  async updateStatus(
    ticketId: string,
    adminUserId: string,
    body: AdminSupportStatusDto,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const ticket = await lockSupportTicket(transaction, ticketId);
      if (ticket.status === body.status) {
        return { changed: false, resolvedSlaRecipients: [] as string[] };
      }

      const now = new Date();
      await transaction.supportMessage.create({
        data: {
          ticketId,
          authorUserId: adminUserId,
          authorType: SupportMessageAuthorType.SYSTEM,
          body: statusMessage(body.status),
        },
      });
      await transaction.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: body.status,
          lastMessageAt: now,
          resolvedAt:
            body.status === SupportTicketStatus.RESOLVED
              ? now
              : ACTIVE_STATUSES.includes(body.status)
                ? null
                : ticket.resolvedAt,
          closedAt: body.status === SupportTicketStatus.CLOSED ? now : null,
        },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUserId,
          origin: AuditOrigin.API,
          action: AuditAction.ADMIN_SUPPORT_STATUS_CHANGED,
          result: AuditResult.SUCCESS,
          workspaceId: ticket.workspaceId,
          storeId: ticket.storeId,
          targetType: 'SUPPORT_TICKET',
          targetId: ticketId,
          before: { status: ticket.status },
          after: { status: body.status },
        },
        transaction,
      );
      const resolvedSlaRecipients =
        body.status === SupportTicketStatus.RESOLVED ||
        body.status === SupportTicketStatus.CLOSED
          ? await this.supportNotifications.resolveSlaNotification(
              transaction,
              ticket.id,
            )
          : [];
      return { changed: true, resolvedSlaRecipients };
    });

    if (result.changed) {
      this.supportNotifications.emitRead(result.resolvedSlaRecipients);
    }

    return this.findOne(ticketId);
  }

  async updateAssignee(
    ticketId: string,
    adminUserId: string,
    body: AdminSupportAssigneeDto,
  ) {
    const assignee = body.assigneeUserId
      ? await this.prisma.user.findUnique({
          where: { id: body.assigneeUserId },
          select: { ...personSelect, emailVerified: true },
        })
      : null;

    if (
      body.assigneeUserId &&
      (!assignee ||
        !assignee.emailVerified ||
        !this.adminAccess.isAdminEmail(assignee.email))
    ) {
      throw new BadRequestException(
        'Seçilen kullanıcı geçerli bir admin değil.',
      );
    }

    const message = assignee
      ? `Talep ${assignee.name} adlı yöneticiye atandı.`
      : 'Talebin yönetici ataması kaldırıldı.';

    const result = await this.prisma.$transaction(async (transaction) => {
      const ticket = await lockSupportTicket(transaction, ticketId);
      if (ticket.assignedAdminUserId === body.assigneeUserId) {
        return { changed: false, assigneeRecipients: [] as string[] };
      }

      const now = new Date();
      const nextStatus =
        assignee && ticket.status === SupportTicketStatus.OPEN
          ? SupportTicketStatus.IN_PROGRESS
          : ticket.status;
      const assignmentMessage = await transaction.supportMessage.create({
        data: {
          ticketId,
          authorUserId: adminUserId,
          authorType: SupportMessageAuthorType.SYSTEM,
          isInternal: true,
          body: message,
        },
      });
      await transaction.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedAdminUserId: body.assigneeUserId,
          status: nextStatus,
          updatedAt: now,
        },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUserId,
          origin: AuditOrigin.API,
          action: AuditAction.ADMIN_SUPPORT_ASSIGNEE_CHANGED,
          result: AuditResult.SUCCESS,
          workspaceId: ticket.workspaceId,
          storeId: ticket.storeId,
          targetType: 'SUPPORT_TICKET',
          targetId: ticketId,
          before: {
            assignedAdminUserId: ticket.assignedAdminUserId,
            status: ticket.status,
          },
          after: {
            assignedAdminUserId: body.assigneeUserId,
            status: nextStatus,
          },
        },
        transaction,
      );
      const assigneeRecipients =
        await this.supportNotifications.notifyAssigneeChanged(
          transaction,
          ticket,
          body.assigneeUserId,
          assignmentMessage.id,
        );
      return { changed: true, assigneeRecipients };
    });

    if (result.changed) {
      this.supportNotifications.emitCreated(result.assigneeRecipients, null);
    }

    return this.findOne(ticketId);
  }

  private buildWhere(
    query: AdminSupportTicketsQueryDto,
    currentAdminId: string,
  ): Prisma.SupportTicketWhereInput {
    const searchNumber = parseTicketNumber(query.q);
    const search = query.q
      ? {
          OR: [
            { subject: { contains: query.q, mode: 'insensitive' as const } },
            {
              createdBy: {
                is: {
                  OR: [
                    {
                      name: {
                        contains: query.q,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      email: {
                        contains: query.q,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                },
              },
            },
            {
              workspace: {
                is: {
                  name: {
                    contains: query.q,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
            {
              store: {
                is: {
                  name: {
                    contains: query.q,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
            ...(searchNumber ? [{ number: searchNumber }] : []),
          ],
        }
      : {};

    return {
      ...search,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.assignee === AdminSupportAssigneeFilter.ME
        ? { assignedAdminUserId: currentAdminId }
        : query.assignee === AdminSupportAssigneeFilter.UNASSIGNED
          ? { assignedAdminUserId: null }
          : {}),
    };
  }

  private resolveOrderBy(
    sort: AdminSupportSort,
  ): Prisma.SupportTicketOrderByWithRelationInput[] {
    if (sort === AdminSupportSort.OLDEST) {
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    }
    if (sort === AdminSupportSort.SLA) {
      return [{ firstResponseDueAt: 'asc' }, { lastMessageAt: 'desc' }];
    }
    return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }

  private toSummary(ticket: AdminTicketListRecord) {
    const lastMessage = ticket.messages[0] ?? null;
    return {
      id: ticket.id,
      number: ticket.number,
      code: formatTicketCode(ticket.number, ticket.createdAt),
      category: ticket.category,
      impact: ticket.impact,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      planSnapshot: ticket.planSnapshot,
      firstResponseDueAt: ticket.firstResponseDueAt,
      firstRespondedAt: ticket.firstRespondedAt,
      lastMessageAt: ticket.lastMessageAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      workspace: ticket.workspace,
      store: ticket.store,
      createdBy: ticket.createdBy,
      assignedAdmin: ticket.assignedAdmin,
      messageCount: ticket._count.messages,
      lastMessage,
    };
  }

  private toDetail(ticket: AdminTicketDetailRecord) {
    const lastMessage = ticket.messages[ticket.messages.length - 1] ?? null;
    return {
      ...this.toSummary({
        ...ticket,
        messages: lastMessage
          ? [
              {
                body: lastMessage.body,
                authorType: lastMessage.authorType,
                isInternal: lastMessage.isInternal,
                createdAt: lastMessage.createdAt,
              },
            ]
          : [],
      }),
      context: sanitizeContext(ticket.context),
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        isInternal: message.isInternal,
        body: message.body,
        createdAt: message.createdAt,
        author: message.author,
      })),
    };
  }
}

function parseTicketNumber(query: string | undefined) {
  if (!query) return null;
  const matched = query.match(/(?:^|-)0*(\d+)$/);
  if (!matched) return null;
  const value = Number(matched[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function statusMessage(status: SupportTicketStatus) {
  const messages: Record<SupportTicketStatus, string> = {
    OPEN: 'Destek ekibi talebi yeniden açtı.',
    IN_PROGRESS: 'Destek ekibi talebi incelemeye aldı.',
    WAITING_CUSTOMER: 'Destek ekibi kullanıcı yanıtını bekliyor.',
    RESOLVED: 'Destek ekibi talebi çözüldü olarak işaretledi.',
    CLOSED: 'Destek ekibi talebi kapattı.',
  };
  return messages[status];
}

function sanitizeContext(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const context = value;
  return {
    pagePath: typeof context.pagePath === 'string' ? context.pagePath : null,
    userAgent: typeof context.userAgent === 'string' ? context.userAgent : null,
  };
}

function formatTicketCode(number: number, createdAt: Date) {
  return `CA-${createdAt.getUTCFullYear()}-${String(number).padStart(6, '0')}`;
}
