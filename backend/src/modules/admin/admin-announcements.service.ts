import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResendEmailService } from '../notifications/resend-email.service';
import { renderEmailLayout } from '../notifications/email-templates/email-layout';
import { AdminAccessService } from './admin-access.service';
import {
  announcementAudienceHash,
  announcementUserSelect,
  selectAnnouncementAudience,
} from './admin-announcements.policy';
import {
  AdminAnnouncementsQueryDto,
  PreviewAdminAnnouncementDto,
} from './dto/admin-announcement.dto';

const publicSelect = {
  id: true,
  title: true,
  message: true,
  roles: true,
  sendEmail: true,
  recipientCount: true,
  emailCount: true,
  skippedEmailCount: true,
  createdAt: true,
  expiresAt: true,
  publishedAt: true,
} satisfies Prisma.AdminAnnouncementSelect;

const PAGE_SIZE = 20;

@Injectable()
export class AdminAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly resend: ResendEmailService,
    private readonly audit: AuditLogService,
    private readonly access: AdminAccessService,
  ) {}

  async list(query: AdminAnnouncementsQueryDto) {
    const where: Prisma.AdminAnnouncementWhereInput = {
      publishedAt: { not: null },
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { message: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.adminAnnouncement.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: publicSelect,
      }),
      this.prisma.adminAnnouncement.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
      emailAvailable: this.emailConfiguration() !== null,
    };
  }

  async preview(body: PreviewAdminAnnouncementDto, adminUserId: string) {
    if (body.sendEmail) this.requireEmailConfiguration();
    const audience = await this.audience(this.prisma, body.roles);
    if (!audience.length)
      throw new BadRequestException(
        'Seçilen rollerde duyuru alabilecek müşteri bulunamadı.',
      );
    const emailCount = body.sendEmail
      ? audience.filter((user) => user.emailVerified).length
      : 0;
    await this.prisma.adminAnnouncement.deleteMany({
      where: { publishedAt: null, expiresAt: { lt: new Date() } },
    });
    const preview = await this.prisma.adminAnnouncement.create({
      data: {
        ...body,
        roles: [...body.roles].sort(),
        createdById: adminUserId,
        audienceHash: announcementAudienceHash(audience),
        recipientCount: audience.length,
        emailCount,
        skippedEmailCount: body.sendEmail ? audience.length - emailCount : 0,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
      select: publicSelect,
    });
    return {
      ...preview,
      sample: audience
        .slice(0, 8)
        .map(({ name, email, workspaceName, role }) => ({
          name,
          email,
          workspaceName,
          role,
        })),
    };
  }

  async publish(id: string, adminUserId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const announcement = await tx.adminAnnouncement.findUnique({
          where: { id },
        });
        if (!announcement || announcement.createdById !== adminUserId)
          throw new NotFoundException('Duyuru önizlemesi bulunamadı.');
        if (announcement.publishedAt)
          return { id, recipientIds: [] as string[] };
        const claimed = await tx.adminAnnouncement.updateMany({
          where: {
            id,
            createdById: adminUserId,
            publishedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { publishedAt: new Date() },
        });
        if (!claimed.count) {
          const current = await tx.adminAnnouncement.findUniqueOrThrow({
            where: { id },
          });
          if (current.publishedAt) return { id, recipientIds: [] as string[] };
          throw new ConflictException(
            'Önizlemenin süresi doldu. Göndermeden önce yeniden önizleyin.',
          );
        }
        const audience = await this.audience(tx, announcement.roles);
        if (announcementAudienceHash(audience) !== announcement.audienceHash)
          throw new ConflictException(
            'Alıcı listesi veya rolleri değişti. Yeni listeyi önizleyip tekrar onaylayın.',
          );
        const config = announcement.sendEmail
          ? this.requireEmailConfiguration()
          : null;
        const recipientIds = audience.map((user) => user.userId);
        // Persist notifications, email outbox and audit evidence in one transaction.
        // The existing email worker sends only after this transaction commits.
        for (let offset = 0; offset < audience.length; offset += 200) {
          const batch = audience.slice(offset, offset + 200);
          await this.notifications.createForUsersInTransaction(tx, {
            recipientUserIds: batch.map((user) => user.userId),
            type: 'ADMIN_ANNOUNCEMENT',
            severity: 'INFO',
            title: announcement.title,
            message: announcement.message,
            actionUrl: '/dashboard/settings/notifications',
            entityType: 'ADMIN_ANNOUNCEMENT',
            entityId: id,
            dedupeKey: `announcement:${id}`,
            criticalEmail: false,
          });
          if (config) {
            await tx.emailDeliveryRecord.createMany({
              data: batch
                .filter((user) => user.emailVerified)
                .map((user) => ({
                  deliveryKey: `announcement:${id}:${user.userId}`,
                  recipientUserId: user.userId,
                  workspaceId: user.workspaceId,
                  recipientEmail: user.email,
                  senderEmail: config.sender,
                  emailType: 'ADMIN_ANNOUNCEMENT',
                  subject: announcement.title,
                  html: renderEmailLayout({
                    category: 'Duyuru',
                    eyebrow: 'Core Asistan’dan haberiniz var',
                    preheader: announcement.message.slice(0, 120),
                    title: announcement.title,
                    recipientName: user.name,
                    message: announcement.message,
                    preserveMessageNewlines: true,
                    detailsHtml: '',
                    actionUrl: config.url,
                    actionLabel: 'Bildirimleri görüntüle',
                    footer:
                      'Bu duyuru, Core Asistan müşteri hesabınızdaki rolünüze göre gönderildi.',
                  }),
                })),
              skipDuplicates: true,
            });
          }
        }
        await this.audit.record(
          {
            actorType: AuditActorType.ADMIN,
            actorUserId: adminUserId,
            origin: AuditOrigin.API,
            action: AuditAction.ADMIN_ANNOUNCEMENT_PUBLISHED,
            result: AuditResult.SUCCESS,
            targetType: 'ADMIN_ANNOUNCEMENT',
            targetId: id,
            metadata: {
              roles: announcement.roles,
              recipientCount: announcement.recipientCount,
              emailCount: announcement.emailCount,
              sendEmail: announcement.sendEmail,
            },
          },
          tx,
        );
        return { id, recipientIds };
      },
      { timeout: 30_000 },
    );
    if (result.recipientIds.length)
      this.notifications.emitChange(result.recipientIds, null);
    return this.prisma.adminAnnouncement.findUniqueOrThrow({
      where: { id },
      select: publicSelect,
    });
  }

  private async audience(
    tx: Pick<Prisma.TransactionClient, 'user'>,
    roles: readonly string[],
  ) {
    const users = await tx.user.findMany({
      where: {
        OR: [
          { ownedWorkspace: { isNot: null } },
          { workspaceMembers: { some: {} } },
        ],
      },
      select: announcementUserSelect,
      take: 10_001,
      orderBy: { id: 'asc' },
    });
    if (users.length > 10_000)
      throw new BadRequestException(
        'Bu gönderim için müşteri listesi fazla büyük. Gönderim sınırı 10.000 kullanıcıdır.',
      );
    return selectAnnouncementAudience(
      users,
      roles,
      this.access.getAllowedEmailAddresses(),
    );
  }

  private emailConfiguration() {
    const sender = process.env.NOTIFICATION_EMAIL_FROM?.trim();
    const frontend = process.env.FRONTEND_URL?.trim();
    if (!this.resend.configured || !sender || !frontend) return null;
    try {
      const origin = new URL(frontend);
      if (
        !['https:', 'http:'].includes(origin.protocol) ||
        (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
      )
        return null;
      return {
        sender,
        url: new URL(
          '/dashboard/settings/notifications',
          origin.origin,
        ).toString(),
      };
    } catch {
      return null;
    }
  }

  private requireEmailConfiguration() {
    const config = this.emailConfiguration();
    if (!config)
      throw new BadRequestException(
        'E-posta gönderimi hazır değil. Gönderici, API anahtarı ve uygulama adresini kontrol edin.',
      );
    return config;
  }
}
