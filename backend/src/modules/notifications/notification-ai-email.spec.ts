import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationType } from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ResendEmailService } from './resend-email.service';

void test('usage threshold stages the structured AI email', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.NOTIFICATION_EMAIL_FROM = 'notice@coreasistan.com';

  try {
    const staged: Array<{ html: string; subject: string }> = [];
    const transaction = {
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
      emailDeliveryRecord: {
        upsert: (query: { create: { html: string; subject: string } }) => {
          staged.push(query.create);
          return Promise.resolve(query.create);
        },
      },
    };
    const service = new NotificationDeliveryService(
      {} as PrismaService,
      { configured: true } as ResendEmailService,
    );

    await service.stageDirectEmail(
      transaction as unknown as Prisma.TransactionClient,
      { id: 'notice-1', recipientUserId: 'user-1', occurrenceCount: 1 },
      {
        storeId: 'store-1',
        type: NotificationType.AI_USAGE_LIMIT,
        severity: 'WARNING',
        title: "AI soru hakkınızın %80'i kullanıldı",
        message: 'Kullanımınızı kontrol edin.',
        actionUrl: '/billing',
        aiEmail: { kind: 'USAGE', used: 1200, limit: 1500, remaining: 300 },
      },
    );

    assert.equal(staged.length, 1);
    assert.equal(staged[0].subject, "AI soru hakkınızın %80'i kullanıldı");
    assert.ok(staged[0].html.includes('1.200 / 1.500'));
    assert.ok(staged[0].html.includes('300 soru hakkınız kaldı'));
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
  }
});

void test('review digest sends the structured two-metric email', async () => {
  const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
  process.env.NOTIFICATION_EMAIL_FROM = 'notice@coreasistan.com';

  try {
    const sent: Array<{ html: string }> = [];
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
      send: (input: { html: string }) => {
        sent.push(input);
        return Promise.resolve('SENT');
      },
    };
    const service = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      resend as unknown as ResendEmailService,
    );

    const result = await service.sendAiReviewDigest(
      'user-1',
      'store-1',
      'DeFacto',
      10,
      8,
      'review-digest-1',
    );

    assert.equal(result, true);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].html.includes('İnceleme bekleyen'));
    assert.ok(sent[0].html.includes('Yeni soru'));
    assert.ok(sent[0].html.includes('10'));
    assert.ok(sent[0].html.includes('8'));
  } finally {
    if (previousSender === undefined)
      delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousSender;
  }
});
