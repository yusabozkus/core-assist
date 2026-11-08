import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationType,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { BillingUsageNotificationService } from '../billing/billing-usage-notification.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEmailDigestService } from './notification-email-digest.service';
import {
  DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
  isCriticalQuotaEmail,
} from './notification-email.policy';
import { NotificationsService } from './notifications.service';
import type { NotificationStreamService } from './notification-stream.service';
import type { OperationalEmailIncidentService } from './operational-email-incident.service';
import type { ResendEmailService } from './resend-email.service';
import type { SyncEmailIncidentService } from './sync-email-incident.service';

const envKeys = [
  'NOTIFICATION_EMAIL_FROM',
  'WEB_PUSH_VAPID_PUBLIC_KEY',
  'WEB_PUSH_VAPID_PRIVATE_KEY',
  'FRONTEND_URL',
] as const;
let previousEnvironment: Array<string | undefined>;
beforeEach(() => {
  previousEnvironment = envKeys.map((key) => process.env[key]);
  process.env.NOTIFICATION_EMAIL_FROM = 'Test <notifications@example.test>';
  process.env.FRONTEND_URL = 'https://example.test';
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = '';
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = '';
});
afterEach(() =>
  envKeys.forEach((key, index) => {
    if (previousEnvironment[index] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[index];
  }),
);

type Settings = typeof DEFAULT_NOTIFICATION_DELIVERY_SETTINGS;
type Email = { deliveryKey: string; recipientUserId: string; html: string };
type Notification = {
  id: string;
  recipientUserId: string;
  occurrenceCount: number;
  storeId: string | null;
};

function fixture(
  options: {
    enabled?: boolean;
    quiet?: boolean;
    verified?: boolean;
    configured?: boolean;
  } = {},
) {
  const settings = new Map<string, Settings>();
  const notifications = new Map<string, Notification>();
  const emails = new Map<string, Email>();
  const providerKeys = new Set<string>();
  const profiles = ['owner', 'account-admin', 'store-admin', 'agent', 'viewer'];
  if (options.enabled !== undefined) {
    for (const storeId of ['store-a', 'store-b'])
      for (const userId of profiles) {
        settings.set(`${userId}:${storeId}`, {
          ...DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
          emailEnabled: options.enabled,
          quietHoursEnabled: options.quiet ?? false,
          quietHoursStart: '00:00',
          quietHoursEnd: '00:00',
        });
      }
  }
  const user = (id: string, storeId: string) => ({
    id,
    name: id,
    email: `${id}@example.test`,
    emailVerified: options.verified ?? true,
    notificationDeliverySettings: settings.has(`${id}:${storeId}`)
      ? [settings.get(`${id}:${storeId}`)]
      : [],
    webPushSubscriptions: [],
  });
  const store = {
    id: 'store-a',
    timezone: 'Europe/Istanbul',
    name: 'Test store',
    members: [
      { userId: 'owner', role: StoreRole.OWNER },
      { userId: 'store-admin', role: StoreRole.ADMIN },
      { userId: 'agent', role: StoreRole.AGENT },
      { userId: 'viewer', role: StoreRole.VIEWER },
    ],
    workspace: {
      id: 'workspace',
      ownerId: 'owner',
      members: [{ userId: 'account-admin', role: WorkspaceRole.ADMIN }],
    },
  };
  const prismaMock = {
    store: {
      findUnique: () => Promise.resolve(store),
      findFirst: () => Promise.resolve(store),
    },
    notificationPreference: {
      findMany: () => Promise.resolve([]),
      findUnique: () => Promise.resolve(null),
    },
    webPushSubscription: { count: () => Promise.resolve(0) },
    user: {
      findUnique: ({
        where,
        select,
      }: {
        where: { id: string };
        select: {
          notificationDeliverySettings?: { where: { storeId: string } };
        };
      }) =>
        Promise.resolve(
          user(
            where.id,
            select.notificationDeliverySettings?.where.storeId ?? 'store-a',
          ),
        ),
      findMany: ({
        where,
        select,
      }: {
        where: { id: { in: string[] } };
        select: {
          notificationDeliverySettings: { where: { storeId: string } };
        };
      }) =>
        Promise.resolve(
          where.id.in.map((id) =>
            user(id, select.notificationDeliverySettings.where.storeId),
          ),
        ),
    },
    notificationDeliverySetting: {
      findUnique: ({
        where,
      }: {
        where: { userId_storeId: { userId: string; storeId: string } };
      }) =>
        Promise.resolve(
          settings.get(
            `${where.userId_storeId.userId}:${where.userId_storeId.storeId}`,
          ) ?? null,
        ),
      createMany: ({
        data,
        skipDuplicates,
      }: {
        data: Array<{
          userId: string;
          storeId: string;
          emailEnabled: boolean;
          timezone: string;
        }>;
        skipDuplicates: boolean;
      }) => {
        assert.equal(skipDuplicates, true);
        for (const item of data)
          if (!settings.has(`${item.userId}:${item.storeId}`))
            settings.set(`${item.userId}:${item.storeId}`, {
              ...DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
              emailEnabled: item.emailEnabled,
              timezone: item.timezone,
            });
        return Promise.resolve({ count: data.length });
      },
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { userId_storeId: { userId: string; storeId: string } };
        create: Partial<Settings>;
        update: Partial<Settings>;
      }) => {
        const key = `${where.userId_storeId.userId}:${where.userId_storeId.storeId}`;
        const changes = Object.fromEntries(
          Object.entries(settings.has(key) ? update : create).filter(
            ([, value]) => value !== undefined,
          ),
        );
        settings.set(key, {
          ...DEFAULT_NOTIFICATION_DELIVERY_SETTINGS,
          ...settings.get(key),
          ...changes,
        });
        return Promise.resolve(settings.get(key));
      },
      findMany: ({ where }: { where: { id?: { gt: string } } }) =>
        Promise.resolve(
          [...settings.entries()]
            .map(([key, value], index) => ({
              id: `setting-${index}`,
              key,
              value,
            }))
            .filter(
              (item) =>
                item.value.emailEnabled && (!where.id || item.id > where.id.gt),
            )
            .map((item) => {
              const [userId, storeId] = item.key.split(':');
              return { id: item.id, userId, storeId };
            }),
        ),
    },
    notification: {
      upsert: ({
        where,
        create,
      }: {
        where: {
          recipientUserId_dedupeKey: {
            recipientUserId: string;
            dedupeKey: string;
          };
        };
        create: { recipientUserId: string; storeId: string | null };
      }) => {
        const key = `${where.recipientUserId_dedupeKey.recipientUserId}:${where.recipientUserId_dedupeKey.dedupeKey}`;
        const previous = notifications.get(key);
        const saved = {
          ...create,
          id: previous?.id ?? `notification-${notifications.size}`,
          occurrenceCount: (previous?.occurrenceCount ?? 0) + 1,
        };
        notifications.set(key, saved);
        return Promise.resolve(saved);
      },
    },
    emailDeliveryRecord: {
      upsert: ({
        where,
        create,
      }: {
        where: { deliveryKey: string };
        create: Email;
      }) => {
        if (!emails.has(where.deliveryKey))
          emails.set(where.deliveryKey, create);
        return Promise.resolve({ id: where.deliveryKey });
      },
    },
    notificationEmailDigestState: {
      upsert: ({
        create,
      }: {
        create: { recipientUserId: string; storeId: string; type: string };
      }) =>
        Promise.resolve({
          id: `digest:${create.recipientUserId}:${create.storeId}:${create.type}`,
          claimUntil: null,
          pendingUntil: null,
          lastIncludedAt: null,
          idempotencyKey: null,
        }),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    productQuestion: { count: () => Promise.resolve(20) },
    $queryRaw: () => Promise.resolve([{ count: 20, latestAt: new Date() }]),
    $transaction: (
      callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prismaMock as unknown as Prisma.TransactionClient),
  };
  const prisma = prismaMock as unknown as PrismaService;
  const resend = {
    configured: options.configured ?? true,
    send: (input: Email) => {
      emails.set(input.deliveryKey, emails.get(input.deliveryKey) ?? input);
      providerKeys.add(input.deliveryKey);
      return Promise.resolve('SENT');
    },
  } as unknown as ResendEmailService;
  const delivery = new NotificationDeliveryService(prisma, resend);
  const service = new NotificationsService(
    prisma,
    { emit: () => undefined } as unknown as NotificationStreamService,
    delivery,
    {} as SyncEmailIncidentService,
    {} as OperationalEmailIncidentService,
  );
  const usage = new BillingUsageNotificationService(service);
  const threshold = (used: number, storeId = 'store-a', periodId = 'period') =>
    usage.notifyAiQuestionThreshold(storeId, {
      charged: true,
      periodId,
      previousUsed: used - 1,
      used,
      limit: 100,
      remaining: 100 - used,
    });
  return {
    service,
    delivery,
    threshold,
    settings,
    notifications,
    emails,
    providerKeys,
    prisma,
  };
}

void test('defaults apply before visiting preferences and existing opt-outs remain disabled', async () => {
  const enabled = fixture();
  assert.equal(
    (await enabled.service.getDeliverySettings('owner', 'store-a'))
      .emailEnabled,
    true,
  );
  await enabled.threshold(80);
  assert.equal(enabled.settings.get('owner:store-a')?.emailEnabled, true);
  assert.equal(enabled.providerKeys.size, 2);
  const disabled = fixture({ enabled: false });
  assert.equal(
    (await disabled.service.getDeliverySettings('owner', 'store-a'))
      .emailEnabled,
    false,
  );
  await disabled.threshold(80);
  assert.equal(disabled.settings.get('owner:store-a')?.emailEnabled, false);
  assert.equal(disabled.emails.size, 0);
  assert.equal(disabled.notifications.size, 2);
});

void test('changing another preference does not silently disable default emails', async () => {
  const state = fixture();
  const result = await state.service.updateDeliverySettings('owner', {
    storeId: 'store-a',
    quietHoursEnabled: true,
  });
  assert.equal(result.emailEnabled, true);
  assert.equal(result.quietHoursEnabled, true);
  assert.equal(
    (
      await state.service.updateDeliverySettings('owner', {
        storeId: 'store-a',
        emailEnabled: false,
      })
    ).emailEnabled,
    false,
  );
  assert.equal(
    (
      await state.service.updateDeliverySettings('owner', {
        storeId: 'store-a',
        quietHoursEnabled: false,
      })
    ).emailEnabled,
    false,
  );
});

void test('90 and 100 percent quota alerts bypass email opt-out and quiet hours for account finance roles only', async () => {
  const state = fixture({ enabled: false, quiet: true });
  await state.threshold(90);
  await state.threshold(100);
  assert.equal(state.emails.size, 4);
  assert.deepEqual(
    [
      ...new Set(
        [...state.emails.values()].map((email) => email.recipientUserId),
      ),
    ].sort(),
    ['account-admin', 'owner'],
  );
  assert.ok(
    [...state.emails.keys()].every((key) => key.startsWith('critical:')),
  );
  assert.equal(
    state.providerKeys.size,
    0,
    'critical alerts are staged in the existing email outbox',
  );
  for (const email of state.emails.values()) {
    assert.match(email.html, /e-posta tercihinizden bağımsız/);
    assert.doesNotMatch(email.html, /settings\/notifications/);
  }
});

void test('80 percent quota remains optional and respects quiet hours', async () => {
  const state = fixture({ enabled: true, quiet: true });
  await state.threshold(80);
  assert.equal(state.emails.size, 0);
  await state.threshold(90);
  assert.equal(state.emails.size, 2);
});

void test('another marketplace and repeated events do not duplicate a period threshold email', async () => {
  const state = fixture();
  for (const used of [80, 90, 100]) {
    await state.threshold(used, 'store-a');
    await state.threshold(used, 'store-b');
    await state.threshold(used, 'store-a');
  }
  assert.equal(state.notifications.size, 6);
  assert.equal(state.emails.size, 6);
  await state.threshold(90, 'store-a', 'next-period');
  assert.equal(state.emails.size, 8);
});

void test('quota alerts cannot bypass email verification or missing sender configuration', async () => {
  const unverified = fixture({ verified: false });
  await unverified.threshold(90);
  assert.equal(unverified.emails.size, 0);
  const unavailable = fixture({ configured: false });
  await unavailable.threshold(100);
  assert.equal(unavailable.emails.size, 0);
  const settings = await unavailable.service.getDeliverySettings(
    'owner',
    'store-a',
  );
  assert.equal(settings.emailEnabled, true);
  assert.equal(settings.availability.email, false);
});

void test('20 review notifications are grouped in one digest per eligible recipient', async () => {
  const state = fixture();
  for (let index = 0; index < 20; index++)
    await state.service.createForStoreMembers({
      storeId: 'store-a',
      type: NotificationType.AI_REVIEW_REQUIRED,
      severity: 'WARNING',
      title: 'İnceleme',
      message: 'Yanıt inceleme bekliyor',
      dedupeKey: `review-${index}`,
    });
  assert.equal(state.emails.size, 0);
  assert.equal(state.settings.has('viewer:store-a'), false);
  await new NotificationEmailDigestService(
    state.prisma,
    state.delivery,
  ).sendAiReviewDigests();
  assert.equal(state.emails.size, 4);
  assert.ok([...state.emails.values()].every((email) => /20/.test(email.html)));
});

void test('only validated usage events at or above 90 percent are critical', () => {
  for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.equal(
      isCriticalQuotaEmail({
        type: NotificationType.AI_USAGE_LIMIT,
        aiEmail: { kind: 'USAGE', used: 100, limit, remaining: 0 },
      }),
      false,
    );
  assert.equal(
    isCriticalQuotaEmail({
      type: NotificationType.AI_AUTOMATION_PAUSED,
      aiEmail: { kind: 'USAGE', used: 100, limit: 100, remaining: 0 },
    }),
    false,
  );
  assert.equal(
    isCriticalQuotaEmail({ type: NotificationType.AI_USAGE_LIMIT }),
    false,
  );
  assert.equal(
    isCriticalQuotaEmail({
      type: NotificationType.AI_USAGE_LIMIT,
      aiEmail: { kind: 'USAGE', used: 89, limit: 100, remaining: 11 },
    }),
    false,
  );
  assert.equal(
    isCriticalQuotaEmail({
      type: NotificationType.AI_USAGE_LIMIT,
      aiEmail: { kind: 'USAGE', used: 90, limit: 100, remaining: 10 },
    }),
    true,
  );
});
