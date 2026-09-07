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
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  ListNotificationsQueryDto,
  NotificationReadFilter,
} from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { UpdateNotificationDeliverySettingsDto } from './dto/update-notification-delivery-settings.dto';
import {
  RemoveWebPushSubscriptionDto,
  SaveWebPushSubscriptionDto,
} from './dto/web-push-subscription.dto';

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
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streamEvents: NotificationStreamService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async stream(userId: string, storeId: string) {
    await this.assertStoreMembership(userId, storeId);
    return this.streamEvents.forUser(userId, storeId);
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
      preferences: Object.values(NotificationType).map((type) => ({
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
      emailEnabled: settings?.emailEnabled ?? false,
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
        emailEnabled: body.emailEnabled,
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

    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
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
      ...(query.storeId ? { storeId: query.storeId } : {}),
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
        ...(storeId ? { storeId } : {}),
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
        ...(body.storeId ? { storeId: body.storeId } : {}),
      },
      data: { readAt: new Date() },
    });

    if (updated.count > 0) {
      this.streamEvents.emit([userId], body.storeId ?? null, 'READ_ALL');
    }

    return { updated: updated.count };
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

  async createForStoreMembers(input: StoreNotificationInput) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id: input.storeId },
        select: {
          members: { select: { userId: true } },
          workspace: { select: { ownerId: true } },
        },
      });

      if (!store) return;

      const recipientUserIds = [
        ...new Set([
          store.workspace.ownerId,
          ...store.members.map((member) => member.userId),
        ]),
      ];
      const disabledPreferences =
        await this.prisma.notificationPreference.findMany({
          where: {
            storeId: input.storeId,
            type: input.type,
            enabled: false,
            userId: { in: recipientUserIds },
          },
          select: { userId: true },
        });
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

      await this.prisma.$transaction(
        enabledRecipientUserIds.map((recipientUserId) =>
          this.prisma.notification.upsert({
            where: {
              recipientUserId_dedupeKey: {
                recipientUserId,
                dedupeKey: input.dedupeKey,
              },
            },
            create: {
              recipientUserId,
              storeId: input.storeId,
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
          }),
        ),
      );
      this.streamEvents.emit(enabledRecipientUserIds, input.storeId, 'CREATED');
      try {
        await this.delivery.deliverToUsers(enabledRecipientUserIds, {
          storeId: input.storeId,
          type: input.type,
          severity: input.severity,
          title,
          message,
          actionUrl: input.actionUrl,
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
