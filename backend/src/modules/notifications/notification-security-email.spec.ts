import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationType } from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('security event stages its template with the admin account link', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.NOTIFICATION_EMAIL_FROM = 'security@coreasistan.com';
  process.env.FRONTEND_URL = 'https://coreasistan.com';

  try {
    const staged: Array<{
      deliveryKey: string;
      subject: string;
      html: string;
    }> = [];
    const transaction = {
      user: {
        findUnique: () =>
          Promise.resolve({
            name: 'Yuşa',
            email: 'yusa@example.com',
            emailVerified: true,
          }),
      },
      emailDeliveryRecord: {
        upsert: (input: {
          create: { deliveryKey: string; subject: string; html: string };
        }) => {
          staged.push(input.create);
          return Promise.resolve(input.create);
        },
      },
    };
    const service = new NotificationDeliveryService(
      {} as PrismaService,
      { configured: true } as ResendEmailService,
    );

    await service.stageEssentialEmail(
      transaction as unknown as Prisma.TransactionClient,
      'notification-1',
      {
        recipientUserId: 'admin-1',
        type: NotificationType.SECURITY_ACCOUNT_CHANGED,
        title: 'Yeni giriş yöntemi bağlandı',
        message: 'Google hesabı bağlandı.',
        actionUrl: '/admin/account',
        securityEmail: { kind: 'PROVIDER_LINKED', provider: 'Google' },
      },
    );
    await service.stageEssentialEmail(
      transaction as unknown as Prisma.TransactionClient,
      'notification-2',
      {
        recipientUserId: 'user-1',
        type: NotificationType.SECURITY_SESSIONS_REVOKED,
        title: 'Diğer oturumlar sonlandırıldı',
        message: 'Diğer cihazlardaki oturumlar kapatıldı.',
        actionUrl: '/dashboard/settings/profile',
        securityEmail: { kind: 'OTHER_SESSIONS_REVOKED' },
      },
    );

    assert.equal(staged.length, 2);
    assert.equal(staged[0].deliveryKey, 'critical:notification-1');
    assert.equal(staged[0].subject, 'Yeni giriş yöntemi bağlandı');
    assert.match(staged[0].html, /https:\/\/coreasistan.com\/admin\/account/);
    assert.match(
      staged[0].html,
      /Google hesabı Core Asistan profilinize bağlandı/,
    );
    assert.equal(staged[1].deliveryKey, 'critical:notification-2');
    assert.match(
      staged[1].html,
      /https:\/\/coreasistan.com\/dashboard\/settings\/profile/,
    );
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  }
});
