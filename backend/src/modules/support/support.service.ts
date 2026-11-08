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
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import {
  SupportTicketUserAction,
  UpdateSupportTicketStatusDto,
} from './dto/update-support-ticket-status.dto';
import { SupportNotificationService } from './support-notification.service';
import {
  SupportAttachmentService,
  assertSupportImageQuota,
  type StoredSupportImage,
} from './support-attachment.service';
import {
  lockSupportTicket,
  lockSupportTicketForImages,
} from './support-ticket-lock';

const summaryInclude = {
  createdBy: { select: { id: true, name: true, image: true } },
  store: { select: { id: true, name: true } },
  messages: {
    where: { isInternal: false },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true, authorType: true, createdAt: true },
  },
  _count: {
    select: { messages: { where: { isInternal: false } } },
  },
} satisfies Prisma.SupportTicketInclude;

const detailInclude = {
  createdBy: { select: { id: true, name: true, image: true } },
  store: { select: { id: true, name: true } },
  messages: {
    where: { isInternal: false },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      author: { select: { id: true, name: true, image: true } },
      attachments: { select: { id: true, contentType: true, size: true } },
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly supportNotifications: SupportNotificationService,
    private readonly workspaces: WorkspacesService,
    private readonly attachments: SupportAttachmentService,
  ) {}

  async findAll(userId: string) {
    const account = await this.findAccountMembership(userId, this.prisma);
    if (!account) {
      return {
        items: [],
        counts: emptySupportStatusCounts(),
        total: 0,
      };
    }

    const [tickets, groupedStatuses] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { workspaceId: account.workspaceId },
        include: summaryInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        where: { workspaceId: account.workspaceId },
        _count: { _all: true },
      }),
    ]);

    const counts = emptySupportStatusCounts();
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

  async findOne(ticketId: string, userId: string) {
    const account = await this.requireAccountMembership(userId);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, workspaceId: account.workspaceId },
      include: detailInclude,
    });
    if (!ticket) throw new NotFoundException('Destek talebi bulunamadı.');
    return this.toDetail(ticket);
  }

  async create(
    userId: string,
    body: CreateSupportTicketDto,
    userAgent?: string,
  ) {
    const now = new Date();
    const context = {
      ...(body.pagePath ? { pagePath: body.pagePath } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
    } satisfies Prisma.InputJsonObject;

    const result = await this.prisma.$transaction(async (transaction) => {
      let account = await this.findAccountMembership(userId, transaction);
      if (!account) {
        await this.workspaces.getOrCreateOwnedWorkspaceInTransaction(
          transaction,
          userId,
        );
        account = await this.requireAccountMembership(userId, transaction);
      }
      const store = body.storeId
        ? await transaction.store.findFirst({
            where: {
              id: body.storeId,
              workspaceId: account.workspaceId,
              members: { some: { userId } },
            },
            select: { id: true },
          })
        : null;
      if (body.storeId && !store) {
        throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
      }
      const plan =
        account.workspace.billingSubscription?.plan ?? BillingPlan.STARTER;
      const ticket = await transaction.supportTicket.create({
        data: {
          workspaceId: account.workspaceId,
          storeId: store?.id ?? null,
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
      const recipients = await this.supportNotifications.notifyNewTicket(
        transaction,
        ticket,
      );
      return { ticket, recipients };
    });

    this.supportNotifications.emitCreated(result.recipients, null);
    return this.toDetail(result.ticket);
  }

  async reply(
    ticketId: string,
    userId: string,
    body: CreateSupportMessageDto,
    images: StoredSupportImage[] = [],
  ) {
    const recipients = await this.prisma.$transaction(
      async (transaction) => {
        const account = await this.requireAccountMembership(
          userId,
          transaction,
        );
        const ticket = images.length
          ? await lockSupportTicketForImages(
              transaction,
              ticketId,
              userId,
              account.workspaceId,
            )
          : await lockSupportTicket(transaction, ticketId);
        this.assertTicketAccount(ticket.workspaceId, account.workspaceId);
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

        if (images.length) {
          const usage = await transaction.supportAttachment.aggregate({
            where: { message: { ticket: { workspaceId: ticket.workspaceId } } },
            _sum: { size: true },
          });
          assertSupportImageQuota(usage._sum.size ?? 0, images);
        }

        const now = new Date();
        const message = await transaction.supportMessage.create({
          data: {
            ticketId,
            authorUserId: userId,
            authorType: SupportMessageAuthorType.CUSTOMER,
            body: body.message,
            attachments: images.length ? { create: images } : undefined,
          },
        });
        await transaction.supportTicket.update({
          where: { id: ticketId },
          data: {
            lastMessageAt: now,
            status:
              ticket.status === SupportTicketStatus.WAITING_CUSTOMER
                ? SupportTicketStatus.OPEN
                : ticket.status,
          },
        });
        return this.supportNotifications.notifyCustomerMessage(
          transaction,
          ticket,
          message.id,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    this.supportNotifications.emitCreated(recipients, null);

    return this.findOne(ticketId, userId);
  }

  async replyWithImages(
    ticketId: string,
    userId: string,
    message: string | undefined,
    files: Express.Multer.File[],
  ) {
    await this.findOne(ticketId, userId);
    const images = await this.attachments.upload(files);
    try {
      return await this.reply(
        ticketId,
        userId,
        { message: message?.trim() || 'Görsel eklendi' },
        images,
      );
    } catch (error) {
      await this.attachments.discardUnattached(images);
      throw error;
    }
  }

  async readAttachment(ticketId: string, attachmentId: string, userId: string) {
    const account = await this.requireAccountMembership(userId);
    const attachment = await this.prisma.supportAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          ticketId,
          isInternal: false,
          ticket: { workspaceId: account.workspaceId },
        },
      },
    });
    if (!attachment) throw new NotFoundException('Görsel bulunamadı.');
    return {
      contentType: attachment.contentType,
      bytes: await this.attachments.read(attachment.objectKey),
    };
  }

  async updateStatus(
    ticketId: string,
    userId: string,
    body: UpdateSupportTicketStatusDto,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const account = await this.requireAccountMembership(userId, transaction);
      const ticket = await lockSupportTicket(transaction, ticketId);
      this.assertTicketAccount(ticket.workspaceId, account.workspaceId);
      const resolving = body.action === SupportTicketUserAction.RESOLVE;
      const alreadyInTargetState = resolving
        ? ticket.status === SupportTicketStatus.RESOLVED ||
          ticket.status === SupportTicketStatus.CLOSED
        : ticket.status !== SupportTicketStatus.RESOLVED &&
          ticket.status !== SupportTicketStatus.CLOSED;
      if (alreadyInTargetState) {
        return { changed: false, slaRecipients: [] as string[] };
      }

      const now = new Date();
      const status = resolving
        ? SupportTicketStatus.RESOLVED
        : SupportTicketStatus.OPEN;
      await transaction.supportMessage.create({
        data: {
          ticketId,
          authorType: SupportMessageAuthorType.SYSTEM,
          body: resolving
            ? 'Talep kullanıcı tarafından çözüldü olarak işaretlendi.'
            : 'Talep kullanıcı tarafından yeniden açıldı.',
        },
      });
      await transaction.supportTicket.update({
        where: { id: ticketId },
        data: {
          status,
          resolvedAt: resolving ? now : null,
          closedAt: null,
          lastMessageAt: now,
        },
      });
      const slaRecipients = resolving
        ? await this.supportNotifications.resolveSlaNotification(
            transaction,
            ticketId,
          )
        : [];
      return { changed: true, slaRecipients };
    });

    if (result.changed) {
      this.supportNotifications.emitRead(result.slaRecipients);
    }

    return this.findOne(ticketId, userId);
  }

  private async requireAccountMembership(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const membership = await this.findAccountMembership(userId, client);
    if (!membership) {
      throw new NotFoundException(
        'Müşteri hesabı bulunamadı veya erişiminiz yok.',
      );
    }
    return membership;
  }

  private findAccountMembership(
    userId: string,
    client: Prisma.TransactionClient | PrismaService,
  ) {
    return client.workspaceMember.findUnique({
      where: { userId },
      select: {
        role: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
            billingSubscription: { select: { plan: true } },
          },
        },
      },
    });
  }

  private assertTicketAccount(ticketWorkspaceId: string, workspaceId: string) {
    if (ticketWorkspaceId !== workspaceId) {
      throw new NotFoundException('Destek talebi bulunamadı.');
    }
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
      store: ticket.store,
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
        attachments: message.attachments,
        createdAt: message.createdAt,
        author: message.author
          ? {
              ...message.author,
              name:
                message.authorType === SupportMessageAuthorType.SUPPORT
                  ? publicSupportName(message.author.name)
                  : message.author.name,
            }
          : null,
      })),
    };
  }
}

function publicSupportName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || 'Destek ekibi';

  const firstName = parts[0];
  const surnameInitial = Array.from(parts[parts.length - 1])[0];
  if (!surnameInitial) return firstName;

  return `${firstName} ${surnameInitial.toLocaleUpperCase('tr-TR')}.`;
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

function emptySupportStatusCounts() {
  return Object.fromEntries(
    Object.values(SupportTicketStatus).map((status) => [status, 0]),
  ) as Record<SupportTicketStatus, number>;
}
