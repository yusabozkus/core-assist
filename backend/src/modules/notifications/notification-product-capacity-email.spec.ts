import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('product capacity incident sends the structured usage email', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.NOTIFICATION_EMAIL_FROM = 'notice@coreasistan.com';

  try {
    const sent: Array<{ deliveryKey: string; html: string }> = [];
    const prisma = {
      user: {
        findUnique: () =>
          Promise.resolve({
            name: 'Ayşe',
            email: 'ayse@example.com',
            notificationDeliverySettings: [
              { emailEnabled: true, quietHoursEnabled: false },
            ],
          }),
      },
      notificationPreference: { findUnique: () => Promise.resolve(null) },
    };
    const resend = {
      configured: true,
      send: (input: { deliveryKey: string; html: string }) => {
        sent.push(input);
        return Promise.resolve('SENT');
      },
    };
    const service = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      resend as unknown as ResendEmailService,
    );

    const result = await service.sendSyncIncidentEmail(
      'user-1',
      'store-1',
      NotificationType.BILLING_PLAN_LIMIT,
      'DeFacto: Ürün kapasitesi sınırına ulaşıldı',
      'Yeni ürünler kapasite nedeniyle içe alınamıyor.',
      '/billing',
      'product-capacity-1',
      {
        productCapacity: {
          planName: 'Starter',
          used: 5_000,
          limit: 5_000,
          skippedCount: 12,
        },
      },
    );

    assert.equal(result, 'SENT');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].deliveryKey, 'product-capacity-1');
    assert.ok(sent[0].html.includes('Starter planı'));
    assert.ok(sent[0].html.includes('5.000 / 5.000'));
    assert.ok(sent[0].html.includes('12 ürün alınamadı'));
    assert.ok(sent[0].html.includes('Plan ve kullanımı incele'));
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
  }
});
