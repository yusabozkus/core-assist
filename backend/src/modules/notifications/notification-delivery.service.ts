import { Injectable, Logger } from '@nestjs/common';
import webPush from 'web-push';
import {
  MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  sendSafeWebPush,
} from './web-push-security';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationType,
  type NotificationSeverity,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ResendEmailService } from './resend-email.service';
import {
  DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
  isCriticalQuotaEmail,
  notificationEmailDeliveryKey,
} from './notification-email.policy';
import {
  FINANCE_TRANSACTIONAL_EMAIL_TYPES,
  SECURITY_TRANSACTIONAL_EMAIL_TYPES,
} from './critical-email.policy';
import {
  renderSecurityEmail,
  type SecurityEmailEvent,
} from './email-templates/security-email.template';
import {
  renderBillingEmail,
  type BillingEmailEvent,
} from './email-templates/billing-email.template';
import {
  renderAiEmail,
  type AiEmailEvent,
} from './email-templates/ai-email.template';
import {
  renderStockEmail,
  type StockEmailEvent,
  type StockEmailProduct,
} from './email-templates/stock-email.template';
import {
  renderChannelEmail,
  type ChannelEmailEvent,
} from './email-templates/channel-email.template';
import {
  renderProductCapacityEmail,
  type ProductCapacityEmailEvent,
} from './email-templates/product-capacity-email.template';

type ExternalNotificationInput = {
  storeId: string;
  workspaceId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  emailDeliveryKeys?: Record<string, string>;
  aiEmail?: AiEmailEvent;
  stockEmail?: StockEmailEvent;
  channelEmail?: ChannelEmailEvent;
  productCapacityEmail?: ProductCapacityEmailEvent;
};

type EssentialNotificationInput = {
  recipientUserId: string;
  workspaceId?: string | null;
  storeId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  securityEmail?: SecurityEmailEvent;
  billingEmail?: BillingEmailEvent;
  aiEmail?: AiEmailEvent;
};

type DeliverySettings = {
  browserEnabled: boolean;
  emailEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
};

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly vapidPublicKey =
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null;
  private readonly vapidPrivateKey =
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || null;
  private readonly emailFrom =
    process.env.NOTIFICATION_EMAIL_FROM?.trim() || null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendEmailService,
  ) {
    if (this.browserConfigured) {
      webPush.setVapidDetails(
        process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
          'mailto:support@coreasistan.com',
        this.vapidPublicKey!,
        this.vapidPrivateKey!,
      );
    }
  }

  get browserConfigured() {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  get emailConfigured() {
    return Boolean(this.resend.configured && this.emailFrom);
  }

  get publicKey() {
    return this.browserConfigured ? this.vapidPublicKey : null;
  }

  async stageDirectEmail(
    transaction: Prisma.TransactionClient,
    notification: {
      id: string;
      recipientUserId: string;
      occurrenceCount: number;
    },
    input: ExternalNotificationInput,
  ) {
    if (isCriticalQuotaEmail(input)) {
      return this.stageEssentialEmail(transaction, notification.id, {
        ...input,
        recipientUserId: notification.recipientUserId,
      });
    }
    if (!this.emailConfigured || !isImmediateEmailType(input.type)) return;
    const recipient = await transaction.user.findUnique({
      where: { id: notification.recipientUserId },
      select: {
        name: true,
        email: true,
        notificationDeliverySettings: {
          where: { storeId: input.storeId },
          take: 1,
          select: {
            browserEnabled: true,
            emailEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
      },
    });
    const settings =
      recipient?.notificationDeliverySettings[0] ??
      DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
    if (!recipient || !settings.emailEnabled || this.isQuietTime(settings))
      return;
    const actionUrl = this.toAbsoluteUrl(input.actionUrl);
    const deliveryKey = notificationEmailDeliveryKey(notification, input.type);
    const rendered = input.aiEmail
      ? renderAiEmail({
          recipientName: recipient.name,
          title: input.title,
          message: input.message,
          actionUrl,
          preferencesUrl: this.toAbsoluteUrl(
            '/dashboard/settings/notifications?view=preferences',
          ),
          event: input.aiEmail,
        })
      : {
          subject: input.title,
          html: buildEmailHtml(
            recipient.name,
            input.title,
            input.message,
            actionUrl,
          ),
        };
    await transaction.emailDeliveryRecord.upsert({
      where: { deliveryKey },
      create: {
        deliveryKey,
        recipientUserId: notification.recipientUserId,
        storeId: input.storeId,
        recipientEmail: recipient.email,
        emailType: input.type,
        senderEmail: this.emailFrom!,
        subject: rendered.subject,
        html: rendered.html,
      },
      update: {},
    });
  }

  async stageEssentialEmail(
    transaction: Prisma.TransactionClient,
    notificationId: string,
    input: EssentialNotificationInput,
  ) {
    if (
      !this.emailConfigured ||
      (!FINANCE_TRANSACTIONAL_EMAIL_TYPES.has(input.type) &&
        !SECURITY_TRANSACTIONAL_EMAIL_TYPES.has(input.type) &&
        !isCriticalQuotaEmail(input))
    )
      return;

    const recipient = await transaction.user.findUnique({
      where: { id: input.recipientUserId },
      select: { name: true, email: true, emailVerified: true },
    });
    if (!recipient?.emailVerified) return;
    const deliveryKey = `critical:${notificationId}`;
    const rendered =
      isCriticalQuotaEmail(input) && input.aiEmail
        ? renderAiEmail({
            recipientName: recipient.name,
            title: input.title,
            message: input.message,
            actionUrl: this.toAbsoluteUrl(input.actionUrl),
            event: input.aiEmail,
          })
        : SECURITY_TRANSACTIONAL_EMAIL_TYPES.has(input.type) &&
            input.securityEmail
          ? renderSecurityEmail({
              recipientName: recipient.name,
              event: input.securityEmail,
              actionUrl: this.toAbsoluteUrl(
                input.actionUrl === '/admin/account'
                  ? '/admin/account'
                  : '/dashboard/settings/profile',
              ),
            })
          : FINANCE_TRANSACTIONAL_EMAIL_TYPES.has(input.type) &&
              input.billingEmail
            ? renderBillingEmail({
                recipientName: recipient.name,
                title: input.title,
                message: input.message,
                event: input.billingEmail,
                actionUrl: this.toAbsoluteUrl(input.actionUrl),
              })
            : {
                subject: input.title,
                html: buildEmailHtml(
                  recipient.name,
                  input.title,
                  input.message,
                  this.toAbsoluteUrl(input.actionUrl),
                ),
              };
    await transaction.emailDeliveryRecord.upsert({
      where: { deliveryKey },
      create: {
        deliveryKey,
        recipientUserId: input.recipientUserId,
        storeId: input.storeId ?? null,
        workspaceId: input.workspaceId,
        emailType: input.type,
        recipientEmail: recipient.email,
        senderEmail: this.emailFrom!,
        subject: rendered.subject,
        html: rendered.html,
      },
      update: {},
    });
  }

  async deliverToUsers(
    recipientUserIds: string[],
    input: ExternalNotificationInput,
  ) {
    if (!this.browserConfigured && !this.emailConfigured) return;

    const recipients = await this.prisma.user.findMany({
      where: { id: { in: recipientUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        notificationDeliverySettings: {
          where: { storeId: input.storeId },
          take: 1,
          select: {
            browserEnabled: true,
            emailEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
        webPushSubscriptions: {
          take: MAX_PUSH_SUBSCRIPTIONS_PER_USER,
          select: { id: true, endpoint: true, p256dh: true, auth: true },
        },
      },
    });

    await Promise.all(
      recipients.map(async (recipient) => {
        const settings =
          recipient.notificationDeliverySettings[0] ??
          DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
        if (this.isQuietTime(settings)) return;

        const deliveries: Promise<void>[] = [];
        if (settings.browserEnabled && this.browserConfigured) {
          deliveries.push(
            this.sendBrowserNotifications(
              recipient.webPushSubscriptions,
              input,
            ),
          );
        }
        if (
          settings.emailEnabled &&
          this.emailConfigured &&
          isImmediateEmailType(input.type) &&
          !isCriticalQuotaEmail(input)
        ) {
          const key = input.emailDeliveryKeys?.[recipient.id];
          if (!key) throw new Error('Email delivery key is missing.');
          deliveries.push(
            this.sendEmail(
              recipient.id,
              recipient.email,
              recipient.name,
              input,
              key,
            ).then(() => undefined),
          );
        }
        await Promise.all(deliveries);
      }),
    );
  }

  async sendAiReviewDigest(
    recipientUserId: string,
    storeId: string,
    storeName: string,
    pendingCount: number,
    newCount: number,
    idempotencyKey: string,
  ) {
    if (!this.emailConfigured) return false;

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: {
        name: true,
        email: true,
        notificationDeliverySettings: {
          where: { storeId },
          take: 1,
          select: {
            browserEnabled: true,
            emailEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
      },
    });
    const settings =
      recipient?.notificationDeliverySettings[0] ??
      DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
    if (!recipient || !settings.emailEnabled || this.isQuietTime(settings))
      return false;

    const result = await this.sendEmail(
      recipientUserId,
      recipient.email,
      recipient.name,
      {
        storeId,
        type: NotificationType.AI_REVIEW_REQUIRED,
        severity: 'WARNING',
        title: `${storeName.slice(0, 80)}: ${pendingCount} soru incelemenizi bekliyor`,
        message: `${newCount} yeni soruyla birlikte ${pendingCount} soru incelemenizi bekliyor. Taslakları gelen kutunuzdan kontrol edebilirsiniz.`,
        actionUrl: '/dashboard/inbox',
      },
      idempotencyKey,
      { kind: 'REVIEW_DIGEST', pendingCount, newCount },
    );
    if (result === 'DEFERRED')
      throw new Error('AI review email is queued for retry.');
    return true;
  }

  async sendStockDigest(
    recipientUserId: string,
    storeId: string,
    storeName: string,
    type: 'LOW_STOCK' | 'OUT_OF_STOCK',
    currentCount: number,
    newCount: number,
    idempotencyKey: string,
    products: StockEmailProduct[],
  ) {
    if (!this.emailConfigured) return false;

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: {
        name: true,
        email: true,
        notificationDeliverySettings: {
          where: { storeId },
          take: 1,
          select: {
            browserEnabled: true,
            emailEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
      },
    });
    const settings =
      recipient?.notificationDeliverySettings[0] ??
      DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
    if (!recipient || !settings.emailEnabled || this.isQuietTime(settings))
      return false;

    const depleted = type === NotificationType.OUT_OF_STOCK;
    const result = await this.sendEmail(
      recipientUserId,
      recipient.email,
      recipient.name,
      {
        storeId,
        type,
        severity: depleted ? 'ERROR' : 'WARNING',
        title: `${storeName.slice(0, 80)}: ${newCount} varyant ${depleted ? 'tükendi' : 'kritik stokta'}`,
        message: depleted
          ? `${newCount} varyantın stoğu tükendi. Mağazanızda şu anda toplam ${currentCount} varyantın stoğu sıfır. Stok takibi sayfasından kontrol edebilirsiniz.`
          : `${newCount} varyant kritik stok seviyesine düştü. Mağazanızda şu anda toplam ${currentCount} varyantın stoğu 5 adet veya altında. Stok takibi sayfasından kontrol edebilirsiniz.`,
        actionUrl: depleted
          ? '/dashboard/catalog/inventory?status=out_of_stock'
          : '/dashboard/catalog/inventory?status=low_stock',
        stockEmail: { kind: type, currentCount, newCount, products },
      },
      idempotencyKey,
    );
    if (result === 'DEFERRED')
      throw new Error('Stock email is queued for retry.');
    return true;
  }

  async sendSyncIncidentEmail(
    recipientUserId: string,
    storeId: string,
    type: NotificationType,
    title: string,
    message: string,
    actionUrl: string,
    idempotencyKey: string,
    templates?: {
      ai?: AiEmailEvent;
      channel?: ChannelEmailEvent;
      productCapacity?: ProductCapacityEmailEvent;
    },
  ): Promise<'SENT' | 'DEFERRED' | 'SKIPPED'> {
    if (!this.emailConfigured) return 'DEFERRED';

    const [recipient, preference] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: recipientUserId },
        select: {
          name: true,
          email: true,
          notificationDeliverySettings: {
            where: { storeId },
            take: 1,
            select: {
              browserEnabled: true,
              emailEnabled: true,
              quietHoursEnabled: true,
              quietHoursStart: true,
              quietHoursEnd: true,
              timezone: true,
            },
          },
        },
      }),
      this.prisma.notificationPreference.findUnique({
        where: {
          userId_storeId_type: { userId: recipientUserId, storeId, type },
        },
        select: { enabled: true },
      }),
    ]);
    if (!recipient) return 'SKIPPED';
    const settings =
      recipient.notificationDeliverySettings[0] ??
      DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
    if (!settings.emailEnabled || preference?.enabled === false)
      return 'SKIPPED';
    if (this.isQuietTime(settings)) return 'DEFERRED';

    const result = await this.sendEmail(
      recipientUserId,
      recipient.email,
      recipient.name,
      {
        storeId,
        type,
        severity: 'ERROR',
        title,
        message,
        actionUrl,
        channelEmail: templates?.channel,
        productCapacityEmail: templates?.productCapacity,
      },
      idempotencyKey,
      templates?.ai,
    );
    return result === 'SENT'
      ? 'SENT'
      : result === 'FAILED'
        ? 'SKIPPED'
        : 'DEFERRED';
  }

  private async sendBrowserNotifications(
    subscriptions: Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>,
    input: ExternalNotificationInput,
  ) {
    const payload = JSON.stringify({
      title: input.title,
      body: input.message,
      url: this.toAbsoluteUrl(input.actionUrl),
      tag: `${input.storeId}:${input.type}`,
      severity: input.severity,
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await sendSafeWebPush(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
          );
        } catch (error) {
          const statusCode = readStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.webPushSubscription.deleteMany({
              where: { id: subscription.id },
            });
            return;
          }
          this.logger.warn(
            `Tarayıcı bildirimi gönderilemedi: ${readErrorMessage(error)}`,
          );
        }
      }),
    );
  }

  private async sendEmail(
    recipientUserId: string,
    email: string,
    name: string,
    input: ExternalNotificationInput,
    idempotencyKey: string,
    aiEmail?: AiEmailEvent,
  ) {
    const actionUrl = this.toAbsoluteUrl(input.actionUrl);
    const event = aiEmail ?? input.aiEmail;
    const rendered = event
      ? renderAiEmail({
          recipientName: name,
          title: input.title,
          message: input.message,
          actionUrl,
          preferencesUrl: this.toAbsoluteUrl(
            '/dashboard/settings/notifications?view=preferences',
          ),
          event,
        })
      : input.stockEmail
        ? renderStockEmail({
            recipientName: name,
            title: input.title,
            message: input.message,
            actionUrl,
            preferencesUrl: this.toAbsoluteUrl(
              '/dashboard/settings/notifications?view=preferences',
            ),
            event: input.stockEmail,
          })
        : input.channelEmail
          ? renderChannelEmail({
              recipientName: name,
              title: input.title,
              message: input.message,
              actionUrl,
              preferencesUrl: this.toAbsoluteUrl(
                '/dashboard/settings/notifications?view=preferences',
              ),
              event: input.channelEmail,
            })
          : input.productCapacityEmail
            ? renderProductCapacityEmail({
                recipientName: name,
                title: input.title,
                message: input.message,
                actionUrl,
                preferencesUrl: this.toAbsoluteUrl(
                  '/dashboard/settings/notifications?view=preferences',
                ),
                event: input.productCapacityEmail,
              })
            : {
                subject: input.title,
                html: buildEmailHtml(
                  name,
                  input.title,
                  input.message,
                  actionUrl,
                ),
              };
    return this.resend.send({
      deliveryKey: idempotencyKey,
      recipientUserId,
      storeId: input.storeId,
      recipientEmail: email,
      emailType: input.type,
      senderEmail: this.emailFrom!,
      subject: rendered.subject,
      html: rendered.html,
    });
  }

  private isQuietTime(settings: DeliverySettings) {
    if (!settings.quietHoursEnabled) return false;

    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: settings.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date());
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      const minute = Number(
        parts.find((part) => part.type === 'minute')?.value,
      );
      const current = hour * 60 + minute;
      const start = toMinutes(settings.quietHoursStart);
      const end = toMinutes(settings.quietHoursEnd);

      if (start === end) return true;
      return start < end
        ? current >= start && current < end
        : current >= start || current < end;
    } catch {
      return false;
    }
  }

  private toAbsoluteUrl(actionUrl?: string) {
    const frontendUrl =
      process.env.FRONTEND_URL?.trim().replace(/\/$/, '') ||
      'http://localhost:3001';
    return actionUrl?.startsWith('/')
      ? `${frontendUrl}${actionUrl}`
      : actionUrl || `${frontendUrl}/dashboard/settings/notifications`;
  }
}

function isImmediateEmailType(type: NotificationType) {
  if (
    FINANCE_TRANSACTIONAL_EMAIL_TYPES.has(type) ||
    SECURITY_TRANSACTIONAL_EMAIL_TYPES.has(type)
  )
    return false;
  return !new Set<NotificationType>([
    NotificationType.AI_REVIEW_REQUIRED,
    NotificationType.LOW_STOCK,
    NotificationType.OUT_OF_STOCK,
    NotificationType.PRODUCT_SYNC_FAILED,
    NotificationType.QUESTION_SYNC_FAILED,
    NotificationType.CHANNEL_CONNECTION_ERROR,
    NotificationType.AI_DRAFT_FAILED,
    NotificationType.ANSWER_DELIVERY_FAILED,
    NotificationType.AI_AUTOMATION_PAUSED,
    NotificationType.BILLING_PLAN_LIMIT,
  ]).has(type);
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function readStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error))
    return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Bilinmeyen hata';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmailHtml(
  name: string,
  title: string,
  message: string,
  actionUrl: string,
) {
  return `
    <div style="background:#f4f5f4;padding:32px 16px;font-family:Arial,sans-serif;color:#17201b">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e6e3;border-radius:16px;padding:28px">
        <p style="margin:0 0 18px;color:#66736b;font-size:13px">Core Asistan</p>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35">${escapeHtml(title)}</h1>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.7">Merhaba ${escapeHtml(name)},</p>
        <p style="margin:0 0 24px;color:#465149;font-size:14px;line-height:1.7">${escapeHtml(message)}</p>
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#177245;color:#fff;text-decoration:none;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:600">Core Asistan'da aç</a>
      </div>
    </div>`;
}
