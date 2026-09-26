import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminEmailsQueryDto } from './dto/admin-emails-query.dto';

export const adminEmailSelect = {
  id: true,
  recipientEmail: true,
  senderEmail: true,
  subject: true,
  emailType: true,
  status: true,
  providerMessageId: true,
  attemptCount: true,
  firstAttemptAt: true,
  lastAttemptAt: true,
  nextAttemptAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  sentAt: true,
  createdAt: true,
  workspace: { select: { id: true, name: true } },
  store: {
    select: {
      id: true,
      name: true,
      workspace: { select: { id: true, name: true } },
    },
  },
  providerMessage: { select: { status: true, statusAt: true } },
} satisfies Prisma.EmailDeliveryRecordSelect;

type EmailRow = Prisma.EmailDeliveryRecordGetPayload<{
  select: typeof adminEmailSelect;
}>;

export function presentAdminEmail(row: EmailRow) {
  const { providerMessage, store, workspace, ...email } = row;
  return {
    ...email,
    workspace: workspace ?? store?.workspace ?? null,
    store: store ? { id: store.id, name: store.name } : null,
    deliveryStatus: providerMessage?.status ?? 'UNKNOWN',
    deliveryStatusAt: providerMessage?.statusAt ?? null,
    nextAttemptAt: row.status === 'PENDING' ? row.nextAttemptAt : null,
  };
}

export function emailScopeWhere(
  query: Pick<
    AdminEmailsQueryDto,
    'workspaceId' | 'storeId' | 'announcementId'
  >,
): Prisma.EmailDeliveryRecordWhereInput {
  return {
    ...(query.workspaceId
      ? {
          OR: [
            { workspaceId: query.workspaceId },
            { store: { workspaceId: query.workspaceId } },
          ],
        }
      : {}),
    ...(query.storeId ? { storeId: query.storeId } : {}),
    ...(query.announcementId
      ? { deliveryKey: { startsWith: `announcement:${query.announcementId}:` } }
      : {}),
  };
}

export function emailListWhere(
  query: AdminEmailsQueryDto,
): Prisma.EmailDeliveryRecordWhereInput {
  if (query.from && query.to && new Date(query.from) >= new Date(query.to))
    throw new BadRequestException(
      'Başlangıç tarihi bitiş tarihinden önce olmalıdır.',
    );
  const and: Prisma.EmailDeliveryRecordWhereInput[] = [emailScopeWhere(query)];
  if (query.status) and.push({ status: query.status });
  if (query.deliveryStatus === 'UNKNOWN') {
    and.push({
      OR: [
        { providerMessage: null },
        { providerMessage: { status: 'UNKNOWN' } },
      ],
    });
  } else if (query.deliveryStatus) {
    and.push({ providerMessage: { status: query.deliveryStatus } });
  }
  if (query.from || query.to)
    and.push({
      createdAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      },
    });
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' as const };
    and.push({
      OR: [
        { recipientEmail: contains },
        { subject: contains },
        { providerMessageId: contains },
        { workspace: { name: contains } },
        { store: { name: contains } },
        { store: { workspace: { name: contains } } },
      ],
    });
  }
  return { AND: and };
}

@Injectable()
export class AdminEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminEmailsQueryDto) {
    const where = emailListWhere(query);
    const [items, total, overview, workspace] = await Promise.all([
      this.prisma.emailDeliveryRecord.findMany({
        where,
        select: adminEmailSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.emailDeliveryRecord.count({ where }),
      this.overview(query),
      query.workspaceId
        ? this.prisma.workspace.findUnique({
            where: { id: query.workspaceId },
            select: { id: true, name: true },
          })
        : null,
    ]);
    if (query.workspaceId && !workspace)
      throw new NotFoundException('Müşteri hesabı bulunamadı.');
    return {
      items: items.map(presentAdminEmail),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      ...overview,
      workspace,
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.emailDeliveryRecord.findUnique({
      where: { id },
      select: {
        ...adminEmailSelect,
        providerMessage: {
          select: {
            status: true,
            statusAt: true,
            events: {
              orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
              take: 100,
              select: {
                id: true,
                type: true,
                status: true,
                occurredAt: true,
                receivedAt: true,
              },
            },
            _count: { select: { events: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('E-posta kaydı bulunamadı.');
    return {
      ...presentAdminEmail(row),
      events: row.providerMessage?.events ?? [],
      eventCount: row.providerMessage?._count.events ?? 0,
    };
  }

  async recentForWorkspace(workspaceId: string) {
    const rows = await this.prisma.emailDeliveryRecord.findMany({
      where: emailScopeWhere({ workspaceId }),
      select: adminEmailSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });
    return rows.map(presentAdminEmail);
  }

  private async overview(query: AdminEmailsQueryDto) {
    const scope = emailScopeWhere(query);
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60_000);
    const count = (condition: Prisma.EmailDeliveryRecordWhereInput) =>
      this.prisma.emailDeliveryRecord.count({
        where: { AND: [scope, condition] },
      });
    const [
      sent,
      delivered,
      pending,
      failed,
      reviewRequired,
      overdue,
      oldestPending,
      lastEvent,
    ] = await Promise.all([
      count({ status: 'SENT', sentAt: { gte: since } }),
      count({
        providerMessage: { status: 'DELIVERED', statusAt: { gte: since } },
      }),
      count({ status: 'PENDING' }),
      count({
        OR: [
          { status: 'FAILED', updatedAt: { gte: since } },
          {
            providerMessage: {
              status: { in: ['FAILED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED'] },
              statusAt: { gte: since },
            },
          },
        ],
      }),
      count({ status: 'REVIEW_REQUIRED' }),
      count({
        status: 'PENDING',
        nextAttemptAt: { lt: new Date(now.getTime() - 5 * 60_000) },
        OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
      }),
      this.prisma.emailDeliveryRecord.findFirst({
        where: { AND: [scope, { status: 'PENDING' }] },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.emailDeliveryEvent.findFirst({
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
    ]);
    return {
      summary: { sent, delivered, pending, failed, reviewRequired },
      health: {
        sendingConfigured: Boolean(
          process.env.RESEND_API_KEY?.trim() &&
          process.env.NOTIFICATION_EMAIL_FROM?.trim(),
        ),
        trackingConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
        senderEmail: process.env.NOTIFICATION_EMAIL_FROM?.trim() || null,
        overdue,
        oldestPendingAt: oldestPending?.createdAt ?? null,
        lastWebhookAt: lastEvent?.receivedAt ?? null,
        checkedAt: now,
      },
    };
  }
}
