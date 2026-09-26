import 'reflect-metadata';
import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import { PrismaService } from '../../database/prisma.service';
import { ResendEmailService } from '../notifications/resend-email.service';
import { ResendWebhookService } from '../notifications/resend-webhook.service';
import { AdminEmailsService } from './admin-emails.service';
import { AdminEmailsQueryDto } from './dto/admin-emails-query.dto';
import { AdminAnnouncementsService } from './admin-announcements.service';
import { AdminAccessService } from './admin-access.service';
import { AnnouncementRole } from './dto/admin-announcement.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStreamService } from '../notifications/notification-stream.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { SyncEmailIncidentService } from '../notifications/sync-email-incident.service';
import { OperationalEmailIncidentService } from '../notifications/operational-email-incident.service';

// Isolated local database: no app users, deliveries, or external services are touched.
const databaseName = `core_assist_email_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const secret = `whsec_${Buffer.from('email-integration-test-secret').toString('base64')}`;
let rootPool: Pool;
let prisma: PrismaService;
let emails: AdminEmailsService;
let webhooks: ResendWebhookService;
let databaseCreated = false;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousSecret = process.env.RESEND_WEBHOOK_SECRET;
const previousApiKey = process.env.RESEND_API_KEY;
const previousSender = process.env.NOTIFICATION_EMAIL_FROM;
const previousFrontend = process.env.FRONTEND_URL;
const customerA = randomUUID();
const customerB = randomUUID();
const storeA = randomUUID();
const recipientId = randomUUID();

before(async () => {
  const url = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '',
  );
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error(
      'Email integration tests require a local PostgreSQL server.',
    );
  rootPool = new Pool({ connectionString: url.toString() });
  await rootPool.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  url.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = url.toString();
  process.env.RESEND_WEBHOOK_SECRET = secret;
  process.env.RESEND_API_KEY = 'email-tests-no-network';
  process.env.NOTIFICATION_EMAIL_FROM = 'Core Asistan <test@example.invalid>';
  process.env.FRONTEND_URL = 'https://example.invalid';
  execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
      timeout: 60000,
    },
  );
  prisma = new PrismaService();
  await prisma.onModuleInit();
  emails = new AdminEmailsService(prisma);
  webhooks = new ResendWebhookService(prisma);
  const secondOwnerId = randomUUID();
  await prisma.user.createMany({
    data: [
      {
        id: recipientId,
        name: 'Email Test A',
        email: 'email-test-a@example.invalid',
        emailVerified: true,
      },
      {
        id: secondOwnerId,
        name: 'Email Test B',
        email: 'email-test-b@example.invalid',
        emailVerified: true,
      },
    ],
  });
  await prisma.workspace.createMany({
    data: [
      { id: customerA, name: 'Test customer A', ownerId: recipientId },
      { id: customerB, name: 'Test customer B', ownerId: secondOwnerId },
    ],
  });
  await prisma.store.create({
    data: { id: storeA, workspaceId: customerA, name: 'Test store A' },
  });
});

after(async () => {
  if (prisma) await prisma.onModuleDestroy();
  if (rootPool) {
    if (
      databaseCreated &&
      /^core_assist_email_test_[a-f0-9]{12}$/.test(databaseName)
    )
      await rootPool.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await rootPool.end();
  }
  restore('DATABASE_URL', previousDatabaseUrl);
  restore('RESEND_WEBHOOK_SECRET', previousSecret);
  restore('RESEND_API_KEY', previousApiKey);
  restore('NOTIFICATION_EMAIL_FROM', previousSender);
  restore('FRONTEND_URL', previousFrontend);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function webhook(
  type: string,
  messageId: string,
  id = `msg_${randomUUID()}`,
  occurredAt = new Date(),
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = Buffer.from(
    JSON.stringify({
      type,
      created_at: occurredAt.toISOString(),
      data: {
        email_id: messageId,
        to: ['private@example.invalid'],
        subject: 'must not be saved',
      },
    }),
  );
  const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
    .update(`${id}.${timestamp}.`)
    .update(raw)
    .digest('base64');
  return { raw, headers: { id, timestamp, signature: `v1,${signature}` } };
}

void test('an early webhook survives the send response and API output excludes sensitive content', async () => {
  const messageId = randomUUID();
  const delivered = webhook('email.delivered', messageId);
  const originalFetch = global.fetch;
  global.fetch = async () => {
    await webhooks.receive(delivered.raw, delivered.headers);
    return Response.json({ id: messageId });
  };
  try {
    const resend = new ResendEmailService(prisma);
    const key = `email-test:${randomUUID()}`;
    assert.equal(
      await resend.send({
        deliveryKey: key,
        recipientUserId: recipientId,
        storeId: storeA,
        recipientEmail: 'email-test-a@example.invalid',
        senderEmail: 'test@example.invalid',
        subject: 'Early event',
        html: '<p>private invite token</p>',
        sensitive: true,
      }),
      'SENT',
    );
    const record = await prisma.emailDeliveryRecord.findUniqueOrThrow({
      where: { deliveryKey: key },
    });
    const detail = await emails.findOne(record.id);
    assert.equal(detail.deliveryStatus, 'DELIVERED');
    assert.equal(detail.status, 'SENT');
    assert.equal(detail.workspace?.id, customerA);
    assert.equal(detail.events.length, 1);
    const serialized = JSON.stringify(detail);
    for (const hidden of [
      'private invite token',
      'deliveryKey',
      'claimToken',
      'html',
      'must not be saved',
    ])
      assert.ok(!serialized.includes(hidden));
  } finally {
    global.fetch = originalFetch;
  }
});

void test('duplicate and concurrent out-of-order events keep the strongest delivery result', async () => {
  const messageId = randomUUID();
  const duplicate = webhook('email.delivered', messageId);
  await Promise.all(
    Array.from({ length: 5 }, () =>
      webhooks.receive(duplicate.raw, duplicate.headers),
    ),
  );
  assert.equal(
    await prisma.emailDeliveryEvent.count({
      where: { providerMessageId: messageId },
    }),
    1,
  );
  const eventTypes = [
    'email.complained',
    'email.sent',
    'email.bounced',
    'email.delivery_delayed',
    'email.delivered',
  ];
  await Promise.all(
    eventTypes.map((type) => {
      const event = webhook(type, messageId);
      return webhooks.receive(event.raw, event.headers);
    }),
  );
  const message = await prisma.emailProviderMessage.findUniqueOrThrow({
    where: { id: messageId },
  });
  assert.equal(message.status, 'COMPLAINED');
  assert.equal(
    await prisma.emailDeliveryEvent.count({
      where: { providerMessageId: messageId },
    }),
    6,
  );
});

void test('rejects forged events without storing anything; accepts unsupported events without storing content', async () => {
  const messageId = randomUUID();
  const forged = webhook('email.delivered', messageId);
  await assert.rejects(
    webhooks.receive(forged.raw, {
      ...forged.headers,
      signature: 'v1,invalid',
    }),
  );
  assert.equal(
    await prisma.emailProviderMessage.count({ where: { id: messageId } }),
    0,
  );
  const unsupported = webhook('email.opened', messageId);
  assert.deepEqual(
    await webhooks.receive(unsupported.raw, unsupported.headers),
    { received: true, ignored: true },
  );
  assert.equal(
    await prisma.emailProviderMessage.count({ where: { id: messageId } }),
    0,
  );
});

void test('account filters isolate shared recipients, include invitations, and paginate with stable ordering', async () => {
  const createdAt = new Date('2026-09-24T12:00:00Z');
  const base = {
    recipientUserId: recipientId,
    recipientEmail: 'shared@example.invalid',
    senderEmail: 'test@example.invalid',
    subject: 'Shared recipient filter',
    createdAt,
  };
  await prisma.emailDeliveryRecord.createMany({
    data: [
      {
        ...base,
        deliveryKey: randomUUID(),
        workspaceId: customerA,
        emailType: 'TEAM_INVITATION',
      },
      { ...base, deliveryKey: randomUUID(), workspaceId: customerB },
      { ...base, deliveryKey: randomUUID(), storeId: storeA },
      { ...base, deliveryKey: randomUUID() },
    ],
  });
  const query = Object.assign(new AdminEmailsQueryDto(), {
    workspaceId: customerA,
    q: 'Shared recipient',
    pageSize: 1,
  });
  const first = await emails.findAll(query);
  const second = await emails.findAll({ ...query, page: 2 });
  assert.equal(first.pagination.total, 2);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.ok(
    [...first.items, ...second.items].every(
      (email) => email.workspace?.id === customerA,
    ),
  );
  const unknown = await emails.findAll({
    ...query,
    deliveryStatus: 'UNKNOWN',
    pageSize: 25,
  });
  assert.equal(unknown.items.length, 2);
  const otherDay = await emails.findAll({
    ...query,
    from: '2026-09-25T00:00:00+03:00',
    to: '2026-09-26T00:00:00+03:00',
  });
  assert.equal(otherDay.items.length, 0);
  const recent = await emails.recentForWorkspace(customerA);
  assert.ok(
    recent.length <= 5 &&
      recent.every((email) => email.workspace?.id === customerA),
  );
});

void test('summary tracks overdue jobs, uncertain sends and provider failures without conflating acceptance and delivery', async () => {
  const baseline = await emails.findAll(
    Object.assign(new AdminEmailsQueryDto(), { workspaceId: customerB }),
  );
  const messageId = randomUUID();
  const bounced = webhook('email.bounced', messageId);
  await webhooks.receive(bounced.raw, bounced.headers);
  const base = {
    workspaceId: customerB,
    recipientEmail: 'counts@example.invalid',
    senderEmail: 'test@example.invalid',
    subject: 'Summary test',
  };
  await prisma.emailDeliveryRecord.createMany({
    data: [
      {
        ...base,
        deliveryKey: randomUUID(),
        status: 'SENT',
        providerMessageId: messageId,
        sentAt: new Date(),
      },
      { ...base, deliveryKey: randomUUID(), status: 'REVIEW_REQUIRED' },
      {
        ...base,
        deliveryKey: randomUUID(),
        status: 'PENDING',
        nextAttemptAt: new Date(Date.now() - 600000),
      },
    ],
  });
  const result = await emails.findAll(
    Object.assign(new AdminEmailsQueryDto(), { workspaceId: customerB }),
  );
  assert.equal(result.summary.sent, baseline.summary.sent + 1);
  assert.equal(result.summary.failed, baseline.summary.failed + 1);
  assert.equal(result.summary.delivered, baseline.summary.delivered);
  assert.equal(
    result.summary.reviewRequired,
    baseline.summary.reviewRequired + 1,
  );
  assert.equal(result.health.overdue, baseline.health.overdue + 1);
  assert.ok(
    result.health.sendingConfigured &&
      result.health.trackingConfigured &&
      result.health.lastWebhookAt,
  );
});

void test('announcements target roles, atomically publish and safely recover duplicate or invalid confirmations', async (context) => {
  const ids = {
    manager: randomUUID(),
    agent: randomUUID(),
    viewer: randomUUID(),
    platform: randomUUID(),
  };
  const otherStore = randomUUID();
  await prisma.user.createMany({
    data: Object.entries(ids).map(([name, id]) => ({
      id,
      name,
      email: `${name}@announcement.example.invalid`,
      emailVerified: name !== 'viewer',
    })),
  });
  await prisma.workspaceMember.createMany({
    data: Object.entries(ids).map(([name, userId]) => ({
      userId,
      workspaceId: customerA,
      role: name === 'manager' ? ('ADMIN' as const) : ('MEMBER' as const),
    })),
  });
  await prisma.store.create({
    data: { id: otherStore, name: 'Second store', workspaceId: customerA },
  });
  await prisma.storeMember.createMany({
    data: [
      { userId: ids.agent, storeId: storeA, role: 'AGENT' },
      { userId: ids.agent, storeId: otherStore, role: 'AGENT' },
      { userId: ids.viewer, storeId: storeA, role: 'VIEWER' },
      { userId: ids.platform, storeId: storeA, role: 'AGENT' },
    ],
  });
  const emitted: string[][] = [];
  const notifications = new NotificationsService(
    prisma,
    {
      emit: (users: string[]) => emitted.push(users),
    } as unknown as NotificationStreamService,
    {} as NotificationDeliveryService,
    {} as SyncEmailIncidentService,
    {} as OperationalEmailIncidentService,
  );
  const access = {
    getAllowedEmailAddresses: () => ['platform@announcement.example.invalid'],
  } as AdminAccessService;
  const service = new AdminAnnouncementsService(
    prisma,
    notifications,
    new ResendEmailService(prisma),
    new AuditLogService(prisma),
    access,
  );
  const base = {
    title: 'Planlı bakım',
    message: '<script>not executable</script>\nİkinci satır',
    roles: [AnnouncementRole.AGENT, AnnouncementRole.VIEWER],
    sendEmail: true,
  };
  const originalFetch = global.fetch;
  global.fetch = () => Promise.reject(new Error('Tests must never send email'));
  try {
    await context.test(
      'preview has no delivery side effects and only counts verified email recipients',
      async () => {
        const preview = await service.preview(base, recipientId);
        assert.equal(preview.recipientCount, 2);
        assert.equal(preview.emailCount, 1);
        assert.equal(preview.skippedEmailCount, 1);
        assert.equal(
          await prisma.notification.count({ where: { entityId: preview.id } }),
          0,
        );
        assert.equal(
          await prisma.emailDeliveryRecord.count({
            where: {
              deliveryKey: { startsWith: `announcement:${preview.id}:` },
            },
          }),
          0,
        );
        assert.ok(
          !(await service.list()).items.some((item) => item.id === preview.id),
        );
      },
    );
    await context.test(
      'concurrent confirmations produce one notification per person, one email and one audit event',
      async () => {
        const preview = await service.preview(base, recipientId);
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            service.publish(preview.id, recipientId),
          ),
        );
        assert.ok(results.every((result) => result.publishedAt));
        const notices = await prisma.notification.findMany({
          where: { entityId: preview.id },
        });
        assert.deepEqual(
          notices.map((notice) => notice.recipientUserId).sort(),
          [ids.agent, ids.viewer].sort(),
        );
        assert.ok(
          notices.every(
            (notice) =>
              notice.type === 'ADMIN_ANNOUNCEMENT' &&
              notice.storeId === null &&
              notice.message === base.message,
          ),
        );
        const deliveries = await prisma.emailDeliveryRecord.findMany({
          where: { deliveryKey: { startsWith: `announcement:${preview.id}:` } },
        });
        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].recipientUserId, ids.agent);
        assert.equal(deliveries[0].workspaceId, customerA);
        assert.equal(deliveries[0].status, 'PENDING');
        assert.ok(
          deliveries[0].html?.includes(
            '&lt;script&gt;not executable&lt;/script&gt;',
          ),
        );
        assert.ok(!deliveries[0].html?.includes('<script>'));
        assert.ok(deliveries[0].html?.includes('white-space:pre-line'));
        assert.equal(
          await prisma.auditLog.count({
            where: {
              targetId: preview.id,
              action: 'ADMIN_ANNOUNCEMENT_PUBLISHED',
            },
          }),
          1,
        );
        assert.equal(emitted.length, 1);
        const filtered = await emails.findAll(
          Object.assign(new AdminEmailsQueryDto(), {
            announcementId: preview.id,
          }),
        );
        assert.equal(filtered.items.length, 1);
        assert.equal(filtered.summary.pending, 1);
      },
    );
    await context.test(
      'mail switch off publishes only to account managers without an email configuration',
      async () => {
        const previous = process.env.NOTIFICATION_EMAIL_FROM;
        delete process.env.NOTIFICATION_EMAIL_FROM;
        try {
          const preview = await service.preview(
            {
              ...base,
              roles: [AnnouncementRole.ACCOUNT_ADMIN],
              sendEmail: false,
            },
            recipientId,
          );
          assert.equal(preview.recipientCount, 1);
          await service.publish(preview.id, recipientId);
          const notices = await prisma.notification.findMany({
            where: { entityId: preview.id },
          });
          assert.equal(notices[0].recipientUserId, ids.manager);
          assert.equal(
            await prisma.emailDeliveryRecord.count({
              where: {
                deliveryKey: { startsWith: `announcement:${preview.id}:` },
              },
            }),
            0,
          );
          await assert.rejects(
            service.preview(base, recipientId),
            /E-posta gönderimi hazır değil/,
          );
        } finally {
          restore('NOTIFICATION_EMAIL_FROM', previous);
        }
      },
    );
    await context.test(
      'all roles include every customer once but exclude platform admins',
      async () => {
        const preview = await service.preview(
          { ...base, roles: Object.values(AnnouncementRole), sendEmail: false },
          recipientId,
        );
        assert.equal(preview.recipientCount, 5);
        await service.publish(preview.id, recipientId);
        const notices = await prisma.notification.findMany({
          where: { entityId: preview.id },
        });
        assert.equal(notices.length, 5);
        assert.ok(
          !notices.some((notice) => notice.recipientUserId === ids.platform),
        );
      },
    );
    await context.test(
      'changed recipients, expired previews and a different publisher cannot create deliveries',
      async () => {
        const preview = await service.preview(base, recipientId);
        await assert.rejects(
          service.publish(preview.id, ids.manager),
          /bulunamadı/,
        );
        await prisma.storeMember.updateMany({
          where: { userId: ids.agent },
          data: { role: 'ADMIN' },
        });
        try {
          await assert.rejects(
            service.publish(preview.id, recipientId),
            /Alıcı listesi veya rolleri değişti/,
          );
        } finally {
          await prisma.storeMember.updateMany({
            where: { userId: ids.agent },
            data: { role: 'AGENT' },
          });
        }
        await prisma.adminAnnouncement.update({
          where: { id: preview.id },
          data: { expiresAt: new Date(0) },
        });
        await assert.rejects(
          service.publish(preview.id, recipientId),
          /süresi doldu/,
        );
        assert.equal(
          await prisma.notification.count({ where: { entityId: preview.id } }),
          0,
        );
        assert.equal(
          (
            await prisma.adminAnnouncement.findUniqueOrThrow({
              where: { id: preview.id },
            })
          ).publishedAt,
          null,
        );
      },
    );
    await context.test(
      'an audit failure rolls back publication, notifications and the email outbox',
      async () => {
        const failing = new AdminAnnouncementsService(
          prisma,
          notifications,
          new ResendEmailService(prisma),
          {
            record: () => Promise.reject(new Error('audit unavailable')),
          } as unknown as AuditLogService,
          access,
        );
        const preview = await failing.preview(base, recipientId);
        const emissionsBefore = emitted.length;
        await assert.rejects(
          failing.publish(preview.id, recipientId),
          /audit unavailable/,
        );
        assert.equal(
          await prisma.notification.count({ where: { entityId: preview.id } }),
          0,
        );
        assert.equal(
          await prisma.emailDeliveryRecord.count({
            where: {
              deliveryKey: { startsWith: `announcement:${preview.id}:` },
            },
          }),
          0,
        );
        assert.equal(
          (
            await prisma.adminAnnouncement.findUniqueOrThrow({
              where: { id: preview.id },
            })
          ).publishedAt,
          null,
        );
        assert.equal(emitted.length, emissionsBefore);
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
