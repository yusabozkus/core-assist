import { Injectable, Logger } from '@nestjs/common';
import webPush from 'web-push';
import type {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';

type ExternalNotificationInput = {
  storeId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
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
  private readonly resendApiKey = process.env.RESEND_API_KEY?.trim() || null;
  private readonly emailFrom =
    process.env.NOTIFICATION_EMAIL_FROM?.trim() || null;

  constructor(private readonly prisma: PrismaService) {
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
    return Boolean(this.resendApiKey && this.emailFrom);
  }

  get publicKey() {
    return this.browserConfigured ? this.vapidPublicKey : null;
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
          select: { id: true, endpoint: true, p256dh: true, auth: true },
        },
      },
    });

    await Promise.all(
      recipients.map(async (recipient) => {
        const settings = recipient.notificationDeliverySettings[0];
        if (!settings || this.isQuietTime(settings)) return;

        const deliveries: Promise<void>[] = [];
        if (settings.browserEnabled && this.browserConfigured) {
          deliveries.push(
            this.sendBrowserNotifications(
              recipient.webPushSubscriptions,
              input,
            ),
          );
        }
        if (settings.emailEnabled && this.emailConfigured) {
          deliveries.push(
            this.sendEmail(recipient.email, recipient.name, input),
          );
        }
        await Promise.allSettled(deliveries);
      }),
    );
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
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 300 },
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
    email: string,
    name: string,
    input: ExternalNotificationInput,
  ) {
    const actionUrl = this.toAbsoluteUrl(input.actionUrl);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.emailFrom,
        to: [email],
        subject: input.title,
        html: buildEmailHtml(name, input.title, input.message, actionUrl),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn(
        `E-posta bildirimi gönderilemedi (${response.status}): ${(await response.text()).slice(0, 300)}`,
      );
    }
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
