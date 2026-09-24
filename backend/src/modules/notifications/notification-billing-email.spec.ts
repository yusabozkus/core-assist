import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationType } from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('confirmed billing event stages its structured email with an invoice link', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.NOTIFICATION_EMAIL_FROM = 'billing@coreasistan.com';
  process.env.FRONTEND_URL = 'https://coreasistan.com';

  try {
    const staged: Array<{ subject: string; html: string }> = [];
    const transaction = {
      user: {
        findUnique: () =>
          Promise.resolve({
            name: 'Ayşe',
            email: 'ayse@example.com',
            emailVerified: true,
          }),
      },
      emailDeliveryRecord: {
        upsert: (input: { create: { subject: string; html: string } }) => {
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
        recipientUserId: 'user-1',
        type: NotificationType.BILLING_SUBSCRIPTION_CHANGED,
        title: 'Aboneliğiniz etkinleştirildi',
        message: 'Growth planı etkinleştirildi.',
        actionUrl: '/billing/workspace-1/invoices',
        billingEmail: {
          kind: 'SUBSCRIPTION_ACTIVATED',
          plan: 'Growth',
          cycle: 'Aylık',
          nextBilledAt: new Date('2026-10-24T12:00:00.000Z'),
        },
      },
    );

    assert.equal(staged.length, 1);
    assert.equal(staged[0].subject, 'Aboneliğiniz etkinleştirildi');
    assert.match(
      staged[0].html,
      /https:\/\/coreasistan.com\/billing\/workspace-1\/invoices/,
    );
    assert.match(staged[0].html, /24 Ekim 2026/);
    assert.match(staged[0].html, /Faturaları görüntüle/);
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  }
});
