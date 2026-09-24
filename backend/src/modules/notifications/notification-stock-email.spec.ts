import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('stock digest sends the structured product email', async () => {
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

    const result = await service.sendStockDigest(
      'user-1',
      'store-1',
      'DeFacto',
      'LOW_STOCK',
      18,
      4,
      'stock-digest-1',
      [
        {
          name: 'Pamuklu Tişört',
          variant: 'Siyah · M',
          stock: 2,
          imageUrl: 'https://cdn.dsmcdn.com/product-1.jpg',
        },
      ],
    );

    assert.equal(result, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].deliveryKey, 'stock-digest-1');
    assert.ok(sent[0].html.includes('Pamuklu Tişört'));
    assert.ok(sent[0].html.includes('https://cdn.dsmcdn.com/product-1.jpg'));
    assert.ok(sent[0].html.includes('+3 varyant daha'));
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
  }
});
