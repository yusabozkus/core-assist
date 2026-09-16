import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingPlan,
  SupportMessageAuthorType,
  SupportTicketImpact,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import {
  SupportTicketUserAction,
  UpdateSupportTicketStatusDto,
} from './dto/update-support-ticket-status.dto';

const summaryInclude = {
  createdBy: { select: { id: true, name: true, image: true } },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true, authorType: true, createdAt: true },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

const detailInclude = {
  createdBy: { select: { id: true, name: true, image: true } },
  store: { select: { id: true, name: true } },
  messages: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

type SummaryRecord = Prisma.SupportTicketGetPayload<{
  include: typeof summaryInclude;
}>;
type DetailRecord = Prisma.SupportTicketGetPayload<{
  include: typeof detailInclude;
}>;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    const [tickets, groupedStatuses] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { storeId },
        include: summaryInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        where: { storeId },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(SupportTicketStatus).map((status) => [status, 0]),
    ) as Record<SupportTicketStatus, number>;
    for (const group of groupedStatuses) {
      counts[group.status] = group._count._all;
    }

    return {
      items: tickets.map((ticket) => this.toSummary(ticket)),
      counts,
      total: groupedStatuses.reduce(
        (total, group) => total + group._count._all,
        0,
      ),
    };
  }

  async findOne(storeId: string, ticketId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, storeId },
      include: detailInclude,
    });
    if (!ticket) throw new NotFoundException('Destek talebi bulunamadı.');
    return this.toDetail(ticket);
  }

  async create(
    storeId: string,
    userId: string,
    body: CreateSupportTicketDto,
    userAgent?: string,
  ) {
    const membership = await this.requireStoreMembership(storeId, userId);
    const plan =
      membership.store.workspace.billingSubscription?.plan ??
      BillingPlan.STARTER;
    const now = new Date();
    const context = {
      ...(body.pagePath ? { pagePath: body.pagePath } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
    } satisfies Prisma.InputJsonObject;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        workspaceId: membership.store.workspaceId,
        storeId,
        createdByUserId: userId,
        category: body.category,
        impact: body.impact,
        priority: resolvePriority(plan, body.impact),
        subject: body.subject,
        planSnapshot: plan,
        firstResponseDueAt: resolveFirstResponseDueAt(plan, now),
        context,
        messages: {
          create: {
            authorUserId: userId,
            authorType: SupportMessageAuthorType.CUSTOMER,
            body: body.message,
          },
        },
      },
      include: detailInclude,
    });

    return this.toDetail(ticket);
  }

  async reply(
    storeId: string,
    ticketId: string,
    userId: string,
    body: CreateSupportMessageDto,
  ) {
    await this.requireStoreMembership(storeId, userId);
    const ticket = await this.requireTicket(storeId, ticketId);
    if (ticket.status === SupportTicketStatus.CLOSED) {
      throw new BadRequestException(
        'Kapatılmış talebi yanıtlamadan önce yeniden açmalısınız.',
      );
    }
    if (ticket.status === SupportTicketStatus.RESOLVED) {
      throw new BadRequestException(
        'Çözülmüş talebi yanıtlamadan önce yeniden açmalısınız.',
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId,
          authorUserId: userId,
          authorType: SupportMessageAuthorType.CUSTOMER,
          body: body.message,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          lastMessageAt: now,
          status:
            ticket.status === SupportTicketStatus.WAITING_CUSTOMER
              ? SupportTicketStatus.OPEN
              : ticket.status,
        },
      }),
    ]);

    return this.findOne(storeId, ticketId, userId);
  }

  async updateStatus(
    storeId: string,
    ticketId: string,
    userId: string,
    body: UpdateSupportTicketStatusDto,
  ) {
    await this.requireStoreMembership(storeId, userId);
    const ticket = await this.requireTicket(storeId, ticketId);
    const now = new Date();

    if (body.action === SupportTicketUserAction.RESOLVE) {
      if (
        ticket.status === SupportTicketStatus.RESOLVED ||
        ticket.status === SupportTicketStatus.CLOSED
      ) {
        return this.findOne(storeId, ticketId, userId);
      }
      await this.updateStatusWithSystemMessage({
        ticketId,
        status: SupportTicketStatus.RESOLVED,
        message: 'Talep kullanıcı tarafından çözüldü olarak işaretlendi.',
        now,
        resolvedAt: now,
      });
    } else {
      if (
        ticket.status !== SupportTicketStatus.RESOLVED &&
        ticket.status !== SupportTicketStatus.CLOSED
      ) {
        return this.findOne(storeId, ticketId, userId);
      }
      await this.updateStatusWithSystemMessage({
        ticketId,
        status: SupportTicketStatus.OPEN,
        message: 'Talep kullanıcı tarafından yeniden açıldı.',
        now,
        resolvedAt: null,
      });
    }

    return this.findOne(storeId, ticketId, userId);
  }

  private async updateStatusWithSystemMessage(input: {
    ticketId: string;
    status: SupportTicketStatus;
    message: string;
    now: Date;
    resolvedAt: Date | null;
  }) {
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId: input.ticketId,
          authorType: SupportMessageAuthorType.SYSTEM,
          body: input.message,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: input.ticketId },
        data: {
          status: input.status,
          resolvedAt: input.resolvedAt,
          closedAt: null,
          lastMessageAt: input.now,
        },
      }),
    ]);
  }

  private async requireStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: {
        role: true,
        store: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
            workspace: {
              select: {
                billingSubscription: { select: { plan: true } },
              },
            },
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }
    return membership;
  }

  private async requireTicket(storeId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, storeId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Destek talebi bulunamadı.');
    return ticket;
  }

  private toSummary(ticket: SummaryRecord) {
    const lastMessage = ticket.messages[0];
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
      resolvedAt: ticket.resolvedAt,
      createdBy: ticket.createdBy,
      messageCount: ticket._count.messages,
      lastMessage: lastMessage
        ? {
            body: lastMessage.body,
            authorType: lastMessage.authorType,
            createdAt: lastMessage.createdAt,
          }
        : null,
    };
  }

  private toDetail(ticket: DetailRecord) {
    return {
      ...this.toSummary({
        ...ticket,
        messages: ticket.messages.length
          ? [ticket.messages[ticket.messages.length - 1]]
          : [],
      }),
      store: ticket.store,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        body: message.body,
        createdAt: message.createdAt,
        author: message.author,
      })),
    };
  }
}

function resolvePriority(
  plan: BillingPlan,
  impact: SupportTicketImpact,
): SupportTicketPriority {
  if (impact === SupportTicketImpact.BLOCKED) {
    return plan === BillingPlan.BUSINESS
      ? SupportTicketPriority.URGENT
      : SupportTicketPriority.HIGH;
  }
  if (plan === BillingPlan.BUSINESS || plan === BillingPlan.GROWTH) {
    return SupportTicketPriority.HIGH;
  }
  return SupportTicketPriority.NORMAL;
}

function resolveFirstResponseDueAt(plan: BillingPlan, now: Date) {
  if (plan === BillingPlan.BUSINESS) return nextBusinessDeadline(now);
  return addBusinessDays(now, plan === BillingPlan.GROWTH ? 1 : 2);
}

function addBusinessDays(value: Date, days: number) {
  const result = new Date(value);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = istanbulDayOfWeek(result);
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

function nextBusinessDeadline(value: Date) {
  const local = new Date(value.getTime() + 3 * 60 * 60 * 1000);
  let day = local.getUTCDay();
  const beforeCutoff = local.getUTCHours() < 17;

  if (day !== 0 && day !== 6 && beforeCutoff) {
    local.setUTCHours(17, 0, 0, 0);
    return new Date(local.getTime() - 3 * 60 * 60 * 1000);
  }

  do {
    local.setUTCDate(local.getUTCDate() + 1);
    day = local.getUTCDay();
  } while (day === 0 || day === 6);
  local.setUTCHours(17, 0, 0, 0);
  return new Date(local.getTime() - 3 * 60 * 60 * 1000);
}

function istanbulDayOfWeek(value: Date) {
  return new Date(value.getTime() + 3 * 60 * 60 * 1000).getUTCDay();
}

function formatTicketCode(number: number, createdAt: Date) {
  return `CA-${createdAt.getUTCFullYear()}-${String(number).padStart(6, '0')}`;
}
