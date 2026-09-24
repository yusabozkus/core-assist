import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationType,
  SyncEmailDeliveryPhase,
  SyncEmailIncidentKind,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('channel incident delivery sends the branded provider-specific email', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.NOTIFICATION_EMAIL_FROM = 'notice@coreasistan.com';

  try {
    const sent: Array<{ deliveryKey: string; html: string; subject: string }> =
      [];
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
      send: (input: { deliveryKey: string; html: string; subject: string }) => {
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
      NotificationType.PRODUCT_SYNC_FAILED,
      'DeFacto · Hepsiburada: Stok senkronizasyonu sorunlu',
      'Senkronizasyon sorunu devam ediyor.',
      '/dashboard/channels/sync',
      'sync-incident-1',
      {
        channel: {
          providerKey: 'hepsiburada',
          storeName: 'DeFacto',
          kind: SyncEmailIncidentKind.INVENTORY,
          phase: SyncEmailDeliveryPhase.OPEN,
        },
      },
    );

    assert.equal(result, 'SENT');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].deliveryKey, 'sync-incident-1');
    assert.equal(
      sent[0].subject,
      'DeFacto · Hepsiburada: Stok senkronizasyonu sorunlu',
    );
    assert.ok(sent[0].html.includes('Stok senkronizasyonu sorunlu'));
    assert.ok(sent[0].html.includes('merchants/hepsiburada.webp'));
    assert.ok(sent[0].html.includes('Stok bilgileri güncel olmayabilir.'));
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
  }
});
