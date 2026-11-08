import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  NotificationSeverity,
  NotificationType,
  StoreRole,
  WorkspaceRole,
  SyncEmailIncidentKind,
  OperationalEmailIncidentKind,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  ListNotificationsQueryDto,
  NotificationReadFilter,
} from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import {
  NotificationStreamService,
  type NotificationChangeReason,
} from './notification-stream.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
  notificationEmailDeliveryKey,
} from './notification-email.policy';
import { UpdateNotificationDeliverySettingsDto } from './dto/update-notification-delivery-settings.dto';
import { SyncEmailIncidentService } from './sync-email-incident.service';
import { OperationalEmailIncidentService } from './operational-email-incident.service';
import {
  FINANCE_TRANSACTIONAL_EMAIL_TYPES,
  SECURITY_TRANSACTIONAL_EMAIL_TYPES,
} from './critical-email.policy';
import type { SecurityEmailEvent } from './email-templates/security-email.template';
import type { BillingEmailEvent } from './email-templates/billing-email.template';
import type { AiEmailEvent } from './email-templates/ai-email.template';
import {
  RemoveWebPushSubscriptionDto,
  SaveWebPushSubscriptionDto,
} from './dto/web-push-subscription.dto';
import {
  MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  validatePushSubscription,
} from './web-push-security';

export type StoreNotificationInput = {
  storeId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey: string;
  billingEmail?: BillingEmailEvent;
  aiEmail?: AiEmailEvent;
};

type DirectNotificationInput = Omit<StoreNotificationInput, 'storeId'> & {
  recipientUserIds: string[];
  workspaceId?: string;
  storeId?: string | null;
  criticalEmail?: boolean;
};

type WorkspaceNotificationInput = Omit<StoreNotificationInput, 'storeId'>;

type UserNotificationInput = Omit<StoreNotificationInput, 'storeId'> & {
  recipientUserId: string;
  storeId?: string | null;
  securityEmail?: SecurityEmailEvent;
};

const STORE_NOTIFICATION_ROLES: Partial<
  Record<NotificationType, readonly StoreRole[]>
> = {
  [NotificationType.AI_REVIEW_REQUIRED]: [StoreRole.ADMIN, StoreRole.AGENT],
  [NotificationType.AI_DRAFT_FAILED]: [StoreRole.ADMIN, StoreRole.AGENT],
  [NotificationType.ANSWER_DELIVERY_FAILED]: [StoreRole.ADMIN, StoreRole.AGENT],
  [NotificationType.AI_AUTOMATION_PAUSED]: [StoreRole.ADMIN],
  [NotificationType.PRODUCT_SYNC_FAILED]: [StoreRole.ADMIN],
  [NotificationType.QUESTION_SYNC_FAILED]: [StoreRole.ADMIN],
  [NotificationType.CHANNEL_CONNECTION_ERROR]: [StoreRole.ADMIN],
  [NotificationType.LOW_STOCK]: [StoreRole.ADMIN],
  [NotificationType.OUT_OF_STOCK]: [StoreRole.ADMIN],
};

const WORKSPACE_FINANCE_NOTIFICATION_TYPES = new Set<NotificationType>([
  NotificationType.AI_USAGE_LIMIT,
  NotificationType.BILLING_PLAN_LIMIT,
]);

const USER_CONFIGURABLE_NOTIFICATION_TYPES = new Set<NotificationType>([
  NotificationType.AI_REVIEW_REQUIRED,
  NotificationType.AI_DRAFT_FAILED,
  NotificationType.AI_AUTOMATION_PAUSED,
  NotificationType.ANSWER_DELIVERY_FAILED,
  NotificationType.PRODUCT_SYNC_FAILED,
  NotificationType.QUESTION_SYNC_FAILED,
  NotificationType.LOW_STOCK,
  NotificationType.OUT_OF_STOCK,
  NotificationType.CHANNEL_CONNECTION_ERROR,
]);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streamEvents: NotificationStreamService,
    private readonly delivery: NotificationDeliveryService,
    private readonly syncEmailIncidents: SyncEmailIncidentService,
    private readonly operationalEmailIncidents: OperationalEmailIncidentService,
  ) {}

  async recordOperationalFailure(input: {
    storeId: string;
    kind: OperationalEmailIncidentKind;
    connectionId?: string;
  }) {
    try {
      await this.operationalEmailIncidents.recordFailure(input);
    } catch (error) {
      this.logger.error(
        `Operasyon e-posta olayı kaydedilemedi (${input.storeId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async recordOperationalSuccess(input: {
    storeId: string;
    kind: OperationalEmailIncidentKind;
    connectionId?: string;
  }) {
    try {
      await this.operationalEmailIncidents.recordSuccess(input);
    } catch (error) {
      this.logger.error(
        `Operasyon e-posta olayı kapatılamadı (${input.storeId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async resolveOperationalWarning(input: {
    storeId: string;
    kind: OperationalEmailIncidentKind;
    connectionId?: string;
  }) {
    try {
      await this.operationalEmailIncidents.resolveWarning(input);
    } catch (error) {
      this.logger.error(
        `Uyarı e-posta olayı kapatılamadı (${input.storeId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async recordSyncFailure(input: {
    storeId: string;
    connectionId: string;
    kind: SyncEmailIncidentKind;
    runId?: string;
  }) {
    try {
      await this.syncEmailIncidents.recordFailure(input);
    } catch (error) {
      this.logger.error(
        `Senkronizasyon e-posta olayı kaydedilemedi (${input.connectionId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async resolveSyncFailures(
    connectionId: string,
    kinds: SyncEmailIncidentKind[],
  ) {
    try {
      await this.syncEmailIncidents.resolve(connectionId, kinds);
    } catch (error) {
      this.logger.error(
        `Senkronizasyon e-posta olayı kapatılamadı (${connectionId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async discardSyncFailures(connectionId: string) {
    try {
      await this.syncEmailIncidents.discard(connectionId);
    } catch (error) {
      this.logger.error(
        `Senkronizasyon e-posta olayı iptal edilemedi (${connectionId}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
    }
  }

  async stream(userId: string, storeId?: string) {
    if (storeId) await this.assertStoreMembership(userId, storeId);
    return this.streamEvents.forUser(userId, storeId ?? null);
  }

  async getPreferences(userId: string, storeId: string) {
    await this.assertStoreMembership(userId, storeId);

    const savedPreferences = await this.prisma.notificationPreference.findMany({
      where: { userId, storeId },
      select: { type: true, enabled: true },
    });
    const savedByType = new Map(
      savedPreferences.map((preference) => [
        preference.type,
        preference.enabled,
      ]),
    );

    return {
      storeId,
      preferences: [...USER_CONFIGURABLE_NOTIFICATION_TYPES].map((type) => ({
        type,
        enabled: savedByType.get(type) ?? true,
      })),
    };
  }

  async updatePreferences(
    userId: string,
    body: UpdateNotificationPreferencesDto,
  ) {
    await this.assertStoreMembership(userId, body.storeId);

    const unsupportedPreference = body.preferences.find(
      (preference) =>
        !USER_CONFIGURABLE_NOTIFICATION_TYPES.has(preference.type),
    );
    if (unsupportedPreference) {
      throw new BadRequestException(
        'Finans, ekip erişimi ve hesap güvenliği bildirimleri kapatılamaz.',
      );
    }

    await this.prisma.$transaction(
      body.preferences.map((preference) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_storeId_type: {
              userId,
              storeId: body.storeId,
              type: preference.type,
            },
          },
          create: {
            userId,
            storeId: body.storeId,
            type: preference.type,
            enabled: preference.enabled,
          },
          update: { enabled: preference.enabled },
        }),
      ),
    );

    return this.getPreferences(userId, body.storeId);
  }

  async getDeliverySettings(userId: string, storeId: string) {
    const store = await this.assertStoreMembership(userId, storeId);
    const [settings, subscriptionCount] = await Promise.all([
      this.prisma.notificationDeliverySetting.findUnique({
        where: { userId_storeId: { userId, storeId } },
      }),
      this.prisma.webPushSubscription.count({ where: { userId } }),
    ]);

    return {
      storeId,
      browserEnabled: settings?.browserEnabled ?? false,
      emailEnabled:
        settings?.emailEnabled ??
        DEFAULT_NOTIFICATION_DELIVERY_SETTINGS.emailEnabled,
      quietHoursEnabled: settings?.quietHoursEnabled ?? false,
      quietHoursStart: settings?.quietHoursStart ?? '22:00',
      quietHoursEnd: settings?.quietHoursEnd ?? '08:00',
      timezone: settings?.timezone ?? store.timezone,
      availability: {
        browser: this.delivery.browserConfigured,
        email: this.delivery.emailConfigured,
        browserSubscribed: subscriptionCount > 0,
      },
    };
  }

  async updateDeliverySettings(
    userId: string,
    body: UpdateNotificationDeliverySettingsDto,
  ) {
    const store = await this.assertStoreMembership(userId, body.storeId);

    if (body.browserEnabled) {
      if (!this.delivery.browserConfigured) {
        throw new BadRequestException(
          'Tarayıcı bildirimleri sunucuda henüz yapılandırılmadı.',
        );
      }
      const hasSubscription = await this.prisma.webPushSubscription.findFirst({
        where: { userId },
        select: { id: true },
      });
      if (!hasSubscription) {
        throw new BadRequestException(
          'Önce bu tarayıcı için bildirim izni verilmelidir.',
        );
      }
    }
    if (body.emailEnabled && !this.delivery.emailConfigured) {
      throw new BadRequestException(
        'E-posta bildirimleri sunucuda henüz yapılandırılmadı.',
      );
    }
    if (body.timezone) this.assertValidTimezone(body.timezone);

    await this.prisma.notificationDeliverySetting.upsert({
      where: { userId_storeId: { userId, storeId: body.storeId } },
      create: {
        userId,
        storeId: body.storeId,
        browserEnabled: body.browserEnabled,
        emailEnabled:
          body.emailEnabled ??
          DEFAULT_NOTIFICATION_DELIVERY_SETTINGS.emailEnabled,
        quietHoursEnabled: body.quietHoursEnabled,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        timezone: body.timezone ?? store.timezone,
      },
      update: {
        browserEnabled: body.browserEnabled,
        emailEnabled: body.emailEnabled,
        quietHoursEnabled: body.quietHoursEnabled,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        timezone: body.timezone,
      },
    });

    return this.getDeliverySettings(userId, body.storeId);
  }

  getWebPushPublicKey() {
    return {
      configured: this.delivery.browserConfigured,
      publicKey: this.delivery.publicKey,
    };
  }

  async saveWebPushSubscription(
    userId: string,
    body: SaveWebPushSubscriptionDto,
  ) {
    await this.assertStoreMembership(userId, body.storeId);
    if (!this.delivery.browserConfigured) {
      throw new BadRequestException(
        'Tarayıcı bildirimleri sunucuda henüz yapılandırılmadı.',
      );
    }

    validatePushSubscription(body);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${userId} FOR UPDATE`;
      const existing = await tx.webPushSubscription.findUnique({
        where: { endpoint: body.endpoint },
        select: { userId: true },
      });
      if (existing && existing.userId !== userId) {
        throw new BadRequestException(
          'Bu tarayıcının mevcut bildirim aboneliğini kaldırıp yeniden deneyin.',
        );
      }
      if (
        !existing &&
        (await tx.webPushSubscription.count({ where: { userId } })) >=
          MAX_PUSH_SUBSCRIPTIONS_PER_USER
      ) {
        throw new BadRequestException(
          'En fazla 10 tarayıcı bildirim aboneliği oluşturabilirsiniz.',
        );
      }
      if (existing) {
        await tx.webPushSubscription.update({
          where: { endpoint: body.endpoint, userId },
          data: { p256dh: body.keys.p256dh, auth: body.keys.auth },
        });
      } else {
        // A concurrent registration by another user must not overwrite keys.
        try {
          await tx.webPushSubscription.create({
            data: {
              userId,
              endpoint: body.endpoint,
              p256dh: body.keys.p256dh,
              auth: body.keys.auth,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new BadRequestException(
              'Tarayıcı aboneliği değişti. Aboneliği kaldırıp yeniden deneyin.',
            );
          }
          throw error;
        }
      }
    });

    return { subscribed: true };
  }

  async removeWebPushSubscription(
    userId: string,
    body: RemoveWebPushSubscriptionDto,
  ) {
    await this.prisma.webPushSubscription.deleteMany({
      where: { userId, endpoint: body.endpoint },
    });
    return { subscribed: false };
  }

  async findAll(userId: string, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      ...(query.storeId
        ? {
            OR: [{ storeId: query.storeId }, { storeId: null }],
          }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status === NotificationReadFilter.UNREAD
        ? { readAt: null }
        : {}),
    };
    const records = await this.prisma.notification.findMany({
      where,
      orderBy: [{ lastOccurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        store: { select: { id: true, name: true } },
      },
    });
    const hasNextPage = records.length > query.limit;
    const items = hasNextPage ? records.slice(0, query.limit) : records;

    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }

  async getUnreadCount(userId: string, storeId?: string) {
    const count = await this.prisma.notification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
        ...(storeId
          ? {
              OR: [{ storeId }, { storeId: null }],
            }
          : {}),
      },
    });

    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientUserId: userId },
      select: { storeId: true },
    });

    if (!notification) {
      throw new NotFoundException('Bildirim bulunamadı.');
    }

    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId },
      data: { readAt: new Date() },
    });

    if (updated.count !== 1) {
      throw new NotFoundException('Bildirim bulunamadı.');
    }

    this.streamEvents.emit([userId], notification.storeId, 'READ');

    return { id: notificationId, read: true };
  }

  async markAllAsRead(userId: string, body: MarkAllNotificationsReadDto) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: userId,
        readAt: null,
        ...(body.storeId
          ? {
              OR: [{ storeId: body.storeId }, { storeId: null }],
            }
          : {}),
      },
      data: { readAt: new Date() },
    });

    if (updated.count > 0) {
      this.streamEvents.emit([userId], body.storeId ?? null, 'READ_ALL');
    }

    return { updated: updated.count };
  }

  async removeAll(userId: string, body: MarkAllNotificationsReadDto) {
    const deleted = await this.prisma.notification.deleteMany({
      where: {
        recipientUserId: userId,
        ...(body.storeId
          ? { OR: [{ storeId: body.storeId }, { storeId: null }] }
          : {}),
      },
    });

    if (deleted.count > 0) {
      this.streamEvents.emit([userId], body.storeId ?? null, 'DELETED');
    }

    return { deleted: deleted.count };
  }

  async remove(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientUserId: userId },
      select: { storeId: true },
    });

    if (!notification) {
      throw new NotFoundException('Bildirim bulunamadı.');
    }

    const deleted = await this.prisma.notification.deleteMany({
      where: { id: notificationId, recipientUserId: userId },
    });

    if (deleted.count !== 1) {
      throw new NotFoundException('Bildirim bulunamadı.');
    }

    this.streamEvents.emit([userId], notification.storeId, 'DELETED');
  }

  // Financial notices target workspace finance roles, never all store admins.
  // Persist in the subscription transaction; a failed insert must remain retryable.
  async createBillingIssue(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    input: {
      title: string;
      message: string;
      dedupeKey: string;
      confirmedFailure?: boolean;
      billingEmail?: BillingEmailEvent;
    },
  ) {
    const workspace = await transaction.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        ownerId: true,
        members: {
          where: { role: { in: ['OWNER', 'ADMIN'] } },
          select: { userId: true },
        },
      },
    });
    if (!workspace) return [];
    const recipients = [
      ...new Set([
        workspace.ownerId,
        ...workspace.members.map((member) => member.userId),
      ]),
    ];
    return this.createForUsersInTransaction(transaction, {
      recipientUserIds: recipients,
      type: NotificationType.BILLING_PAYMENT_ISSUE,
      workspaceId,
      severity: NotificationSeverity.WARNING,
      title: input.title,
      message: input.message,
      dedupeKey: input.dedupeKey,
      actionUrl: `/billing/${workspaceId}`,
      entityType: 'BILLING_WORKSPACE',
      entityId: workspaceId,
      criticalEmail: input.confirmedFailure === true,
      billingEmail: input.billingEmail,
    });
  }

  async createWorkspaceFinanceNotification(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    input: WorkspaceNotificationInput,
  ) {
    const recipients = await this.getWorkspaceFinanceRecipients(
      transaction,
      workspaceId,
    );
    return this.createForUsersInTransaction(transaction, {
      ...input,
      recipientUserIds: recipients,
      storeId: null,
      workspaceId,
    });
  }

  async createForUsersInTransaction(
    transaction: Prisma.TransactionClient,
    input: DirectNotificationInput,
  ) {
    const recipientUserIds = [...new Set(input.recipientUserIds)];
    if (recipientUserIds.length === 0) return [];

    const result = await transaction.notification.createMany({
      data: recipientUserIds.map((recipientUserId) => ({
        recipientUserId,
        storeId: input.storeId ?? null,
        type: input.type,
        severity: input.severity,
        title: input.title.slice(0, 160),
        message: input.message.slice(0, 1_000),
        actionUrl: input.actionUrl,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
      })),
      skipDuplicates: true,
    });

    if (
      input.criticalEmail !== false &&
      FINANCE_TRANSACTIONAL_EMAIL_TYPES.has(input.type)
    ) {
      const notifications = await transaction.notification.findMany({
        where: {
          recipientUserId: { in: recipientUserIds },
          dedupeKey: input.dedupeKey,
          type: input.type,
        },
        select: { id: true, recipientUserId: true },
      });
      for (const notification of notifications) {
        await this.delivery.stageEssentialEmail(transaction, notification.id, {
          recipientUserId: notification.recipientUserId,
          workspaceId: input.workspaceId,
          storeId: input.storeId,
          type: input.type,
          title: input.title.slice(0, 160),
          message: input.message.slice(0, 1_000),
          actionUrl: input.actionUrl,
          billingEmail: input.billingEmail,
        });
      }
    }

    return result.count > 0 ? recipientUserIds : [];
  }

  async createForUser(input: UserNotificationInput) {
    try {
      const now = new Date();
      await this.prisma.$transaction(async (transaction) => {
        const notification = await transaction.notification.upsert({
          where: {
            recipientUserId_dedupeKey: {
              recipientUserId: input.recipientUserId,
              dedupeKey: input.dedupeKey,
            },
          },
          create: {
            recipientUserId: input.recipientUserId,
            storeId: input.storeId ?? null,
            type: input.type,
            severity: input.severity,
            title: input.title.slice(0, 160),
            message: input.message.slice(0, 1_000),
            actionUrl: input.actionUrl,
            entityType: input.entityType,
            entityId: input.entityId,
            dedupeKey: input.dedupeKey,
            lastOccurredAt: now,
          },
          update: {
            severity: input.severity,
            title: input.title.slice(0, 160),
            message: input.message.slice(0, 1_000),
            actionUrl: input.actionUrl,
            occurrenceCount: { increment: 1 },
            readAt: null,
            lastOccurredAt: now,
          },
        });
        if (SECURITY_TRANSACTIONAL_EMAIL_TYPES.has(input.type)) {
          await this.delivery.stageEssentialEmail(
            transaction,
            notification.id,
            {
              recipientUserId: input.recipientUserId,
              storeId: input.storeId,
              type: input.type,
              title: input.title.slice(0, 160),
              message: input.message.slice(0, 1_000),
              actionUrl: input.actionUrl,
              securityEmail: input.securityEmail,
            },
          );
        }
      });
      this.streamEvents.emit(
        [input.recipientUserId],
        input.storeId ?? null,
        'CREATED',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen bildirim hatası';
      this.logger.error(
        `${input.type} kullanıcı bildirimi oluşturulamadı (${input.recipientUserId}): ${message}`,
      );
    }
  }

  async resolveBillingIssues(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const unresolved = await transaction.notification.findMany({
      where: {
        type: NotificationType.BILLING_PAYMENT_ISSUE,
        entityType: 'BILLING_WORKSPACE',
        entityId: workspaceId,
        readAt: null,
      },
      select: { recipientUserId: true },
    });
    if (unresolved.length === 0) return [];

    const resolvedAt = new Date();
    const updated = await transaction.notification.updateMany({
      where: {
        type: NotificationType.BILLING_PAYMENT_ISSUE,
        entityType: 'BILLING_WORKSPACE',
        entityId: workspaceId,
        readAt: null,
      },
      data: { readAt: resolvedAt },
    });
    if (updated.count === 0) return [];

    return [
      ...new Set(
        unresolved.map((notification) => notification.recipientUserId),
      ),
    ];
  }

  emitBillingChange(
    recipientUserIds: string[],
    reason: NotificationChangeReason = 'CREATED',
  ) {
    this.streamEvents.emit(recipientUserIds, null, reason);
  }

  emitChange(
    recipientUserIds: string[],
    storeId: string | null,
    reason: NotificationChangeReason = 'CREATED',
  ) {
    this.streamEvents.emit(recipientUserIds, storeId, reason);
  }

  async createForStoreMembers(input: StoreNotificationInput) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id: input.storeId },
        select: {
          timezone: true,
          members: { select: { userId: true, role: true } },
          workspace: {
            select: {
              id: true,
              ownerId: true,
              members: {
                where: { role: WorkspaceRole.ADMIN },
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!store) return;

      const storeRoles = STORE_NOTIFICATION_ROLES[input.type] ?? [];
      const storeRecipientIds = store.members
        .filter(
          (member) =>
            member.role === StoreRole.OWNER || storeRoles.includes(member.role),
        )
        .map((member) => member.userId);
      const workspaceFinanceNotification =
        WORKSPACE_FINANCE_NOTIFICATION_TYPES.has(input.type);
      const recipientUserIds = workspaceFinanceNotification
        ? [
            ...new Set([
              store.workspace.ownerId,
              ...store.workspace.members.map((member) => member.userId),
            ]),
          ]
        : [
            ...new Set([
              store.workspace.ownerId,
              ...store.workspace.members.map((member) => member.userId),
              ...storeRecipientIds,
            ]),
          ];
      const disabledPreferences = USER_CONFIGURABLE_NOTIFICATION_TYPES.has(
        input.type,
      )
        ? await this.prisma.notificationPreference.findMany({
            where: {
              storeId: input.storeId,
              type: input.type,
              enabled: false,
              userId: { in: recipientUserIds },
            },
            select: { userId: true },
          })
        : [];
      const disabledUserIds = new Set(
        disabledPreferences.map((preference) => preference.userId),
      );
      const enabledRecipientUserIds = recipientUserIds.filter(
        (recipientUserId) => !disabledUserIds.has(recipientUserId),
      );

      if (enabledRecipientUserIds.length === 0) return;

      const now = new Date();
      const title = input.title.slice(0, 160);
      const message = input.message.slice(0, 1_000);

      const notifications = await this.prisma.$transaction(
        async (transaction) => {
          // Initialize defaults when the first event arrives, so digests also
          // work before a user visits preferences. Never override an opt-out.
          await transaction.notificationDeliverySetting.createMany({
            data: enabledRecipientUserIds.map((userId) => ({
              userId,
              storeId: input.storeId,
              emailEnabled: DEFAULT_NOTIFICATION_DELIVERY_SETTINGS.emailEnabled,
              timezone: store.timezone,
            })),
            skipDuplicates: true,
          });
          const saved: Array<{
            id: string;
            recipientUserId: string;
            occurrenceCount: number;
          }> = [];
          for (const recipientUserId of enabledRecipientUserIds) {
            const notification = await transaction.notification.upsert({
              where: {
                recipientUserId_dedupeKey: {
                  recipientUserId,
                  dedupeKey: input.dedupeKey,
                },
              },
              create: {
                recipientUserId,
                storeId: workspaceFinanceNotification ? null : input.storeId,
                type: input.type,
                severity: input.severity,
                title,
                message,
                actionUrl: input.actionUrl,
                entityType: input.entityType,
                entityId: input.entityId,
                dedupeKey: input.dedupeKey,
                lastOccurredAt: now,
              },
              update: {
                storeId: workspaceFinanceNotification ? null : input.storeId,
                type: input.type,
                severity: input.severity,
                title,
                message,
                actionUrl: input.actionUrl,
                entityType: input.entityType,
                entityId: input.entityId,
                occurrenceCount: { increment: 1 },
                readAt: null,
                lastOccurredAt: now,
              },
            });
            await this.delivery.stageDirectEmail(transaction, notification, {
              storeId: input.storeId,
              workspaceId: store.workspace.id,
              type: input.type,
              severity: input.severity,
              title,
              message,
              actionUrl: input.actionUrl,
              aiEmail: input.aiEmail,
            });
            saved.push(notification);
          }
          return saved;
        },
        { timeout: 15_000 },
      );
      this.streamEvents.emit(
        enabledRecipientUserIds,
        workspaceFinanceNotification ? null : input.storeId,
        'CREATED',
      );
      try {
        await this.delivery.deliverToUsers(enabledRecipientUserIds, {
          storeId: input.storeId,
          type: input.type,
          severity: input.severity,
          title,
          message,
          actionUrl: input.actionUrl,
          aiEmail: input.aiEmail,
          emailDeliveryKeys: Object.fromEntries(
            notifications.map((notification) => [
              notification.recipientUserId,
              notificationEmailDeliveryKey(notification, input.type),
            ]),
          ),
        });
      } catch (error) {
        const deliveryError =
          error instanceof Error ? error.message : 'Bilinmeyen teslimat hatası';
        this.logger.warn(
          `${input.type} bildiriminin harici teslimatı tamamlanamadı: ${deliveryError}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen bildirim hatası';
      this.logger.error(
        `${input.type} bildirimi oluşturulamadı (${input.storeId}): ${message}`,
      );
    }
  }

  async createChannelConnectionError(
    storeId: string,
    connectionId: string,
    detail?: string,
  ) {
    await this.createForStoreMembers({
      storeId,
      type: NotificationType.CHANNEL_CONNECTION_ERROR,
      severity: NotificationSeverity.ERROR,
      title: 'Kanal bağlantısı kesildi',
      message:
        detail?.slice(0, 500) ||
        'Pazaryeri bağlantısı doğrulanamadı. Kanal bilgilerinizi kontrol edip yeniden bağlanın.',
      actionUrl: '/dashboard/channels',
      entityType: 'CHANNEL_CONNECTION',
      entityId: connectionId,
      dedupeKey: `channel-connection-error:${connectionId}`,
    });
  }

  private async getWorkspaceFinanceRecipients(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const workspace = await transaction.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        ownerId: true,
        members: {
          where: { role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] } },
          select: { userId: true },
        },
      },
    });
    if (!workspace) return [];
    return [
      ...new Set([
        workspace.ownerId,
        ...workspace.members.map((member) => member.userId),
      ]),
    ];
  }

  private async assertStoreMembership(userId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          { workspace: { ownerId: userId } },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true, timezone: true },
    });

    if (!store) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return store;
  }

  private assertValidTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Geçerli bir saat dilimi girin.');
    }
  }
}
