import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('özetlenen bildirimleri anlık e-posta olarak göndermez', async () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalFetch = global.fetch;
  let fetchCount = 0;

  process.env.RESEND_API_KEY = 'test-key';
  process.env.NOTIFICATION_EMAIL_FROM = 'test@example.com';
  global.fetch = () => {
    fetchCount += 1;
    return Promise.reject(new Error('Anlık e-posta gönderilmemeliydi'));
  };

  try {
    const prisma = {
      user: {
        findMany: () =>
          Promise.resolve([
            {
              id: 'user-1',
              name: 'Test',
              email: 'test@example.com',
              notificationDeliverySettings: [
                {
                  browserEnabled: false,
                  emailEnabled: true,
                  quietHoursEnabled: false,
                  quietHoursStart: '22:00',
                  quietHoursEnd: '08:00',
                  timezone: 'Europe/Istanbul',
                },
              ],
              webPushSubscriptions: [],
            },
          ]),
      },
    };
    const delivery = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      { configured: true } as ResendEmailService,
    );
    for (const type of [
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
      NotificationType.BILLING_PAYMENT_ISSUE,
      NotificationType.SECURITY_ACCOUNT_CHANGED,
    ]) {
      await delivery.deliverToUsers(['user-1'], {
        storeId: 'store-1',
        type,
        severity: NotificationSeverity.WARNING,
        title: 'İnceleme gerekiyor',
        message: 'Taslağı kontrol edin.',
      });
    }
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = originalFrom;
  }
});

void test('notification deduplication and email delivery use separate keys', async () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NOTIFICATION_EMAIL_FROM = 'support@example.com';
  try {
    const keys: string[] = [];
    const transaction = {
      user: {
        findUnique: () =>
          Promise.resolve({
            name: 'Test User',
            email: 'user@example.com',
            notificationDeliverySettings: [
              {
                emailEnabled: true,
                quietHoursEnabled: false,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00',
                timezone: 'Europe/Istanbul',
              },
            ],
          }),
      },
      emailDeliveryRecord: {
        upsert: (query: { where: { deliveryKey: string } }) => {
          keys.push(query.where.deliveryKey);
          return Promise.resolve();
        },
      },
    } as unknown as Prisma.TransactionClient;
    const delivery = new NotificationDeliveryService(
      {} as PrismaService,
      { configured: true } as ResendEmailService,
    );
    const input = {
      storeId: 'store-1',
      type: NotificationType.TEAM_INVITATION_ACCEPTED,
      severity: NotificationSeverity.WARNING,
      title: 'Payment issue',
      message: 'Please update payment details.',
    };
    await delivery.stageDirectEmail(
      transaction,
      { id: 'notification-1', recipientUserId: 'user-1', occurrenceCount: 1 },
      input,
    );
    await delivery.stageDirectEmail(
      transaction,
      { id: 'notification-1', recipientUserId: 'user-1', occurrenceCount: 2 },
      input,
    );
    assert.deepEqual(keys, [
      'notification:notification-1:1',
      'notification:notification-1:2',
    ]);
  } finally {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = originalFrom;
  }
});

void test('critical security email ignores optional notification settings but requires a verified address', async () => {
  const originalFrom = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.NOTIFICATION_EMAIL_FROM = 'support@example.com';
  try {
    const keys: string[] = [];
    let verified = true;
    const transaction = {
      user: {
        findUnique: () =>
          Promise.resolve({
            name: 'Test User',
            email: 'user@example.com',
            emailVerified: verified,
          }),
      },
      emailDeliveryRecord: {
        upsert: (query: { where: { deliveryKey: string } }) => {
          keys.push(query.where.deliveryKey);
          return Promise.resolve();
        },
      },
    } as unknown as Prisma.TransactionClient;
    const delivery = new NotificationDeliveryService(
      {} as PrismaService,
      { configured: true } as ResendEmailService,
    );
    const input = {
      recipientUserId: 'user-1',
      type: NotificationType.SECURITY_ACCOUNT_CHANGED,
      title: 'New sign-in method',
      message: 'Review your account.',
    };
    await delivery.stageEssentialEmail(transaction, 'notice-1', input);
    await delivery.stageEssentialEmail(transaction, 'notice-1', input);
    verified = false;
    await delivery.stageEssentialEmail(transaction, 'notice-2', input);
    assert.deepEqual(keys, ['critical:notice-1', 'critical:notice-1']);
  } finally {
    if (originalFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = originalFrom;
  }
});
