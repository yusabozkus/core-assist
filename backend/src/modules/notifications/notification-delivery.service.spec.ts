import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';

void test('AI inceleme ve stok bildirimlerini anlık e-posta olarak göndermez', async () => {
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
    );
    for (const type of [
      NotificationType.AI_REVIEW_REQUIRED,
      NotificationType.LOW_STOCK,
      NotificationType.OUT_OF_STOCK,
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
