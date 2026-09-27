import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import { dropIsolatedDatabase } from '../../../test/isolated-database';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';
import { BillingAuthorizationService } from './billing-authorization.service';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingQuotaExceededException } from './billing.errors';
import {
  activeBillingSubscriptionWhere,
  hasBillingAccess,
} from './billing-access.policy';
import { PaddleBillingService } from './paddle-billing.service';
import { PaddleCheckoutBindingService } from './paddle-checkout-binding.service';
import { PaddleCheckoutService } from './paddle-checkout.service';
import { PaddlePlanChangeService } from './paddle-plan-change.service';
import { BillingController } from './billing.controller';
import { StoreBillingController } from './store-billing.controller';
import { StoresService } from '../stores/stores.service';
import { StoresController } from '../stores/stores.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { QuestionsService } from '../questions/questions.service';
import { QuestionsController } from '../questions/questions.controller';

const name = `core_assist_billing_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const changedKeys = [
  'DATABASE_URL',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_ENV',
  'PADDLE_PRICE_STARTER_MONTHLY',
  'PADDLE_PRICE_GROWTH_MONTHLY',
  'FRONTEND_URL',
] as const;
const previous = Object.fromEntries(
  changedKeys.map((key) => [key, process.env[key]]),
);
const secret = 'local-only-paddle-webhook-secret';
let pool: Pool,
  prisma: PrismaService,
  subscriptions: BillingSubscriptionService;
let usage: BillingUsageService,
  authorization: BillingAuthorizationService,
  entitlements: BillingEntitlementService;
let stores: StoresService, paddle: PaddleBillingService, app: INestApplication;
let created = false,
  url: string;
const sessions = new Map<string, { id: string; email: string; name: string }>();
let outboundQuestionCalls = 0;

before(async () => {
  const connection = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '',
  );
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname))
    throw new Error('Local PostgreSQL required.');
  pool = new Pool({ connectionString: connection.toString() });
  await pool.query(`CREATE DATABASE "${name}"`);
  created = true;
  connection.pathname = `/${name}`;
  process.env.DATABASE_URL = connection.toString();
  process.env.PADDLE_API_KEY = 'local-test-no-network';
  process.env.PADDLE_WEBHOOK_SECRET = secret;
  process.env.PADDLE_ENV = 'sandbox';
  process.env.PADDLE_PRICE_STARTER_MONTHLY = 'pri_local_starter';
  process.env.PADDLE_PRICE_GROWTH_MONTHLY = 'pri_local_growth';
  process.env.FRONTEND_URL = 'http://localhost:3001';
  execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    { env: process.env, stdio: 'pipe', timeout: 60000 },
  );
  prisma = new PrismaService();
  await prisma.onModuleInit();
  subscriptions = new BillingSubscriptionService(prisma);
  usage = new BillingUsageService(prisma, subscriptions);
  authorization = new BillingAuthorizationService(prisma);
  entitlements = new BillingEntitlementService(
    prisma,
    subscriptions,
    usage,
    authorization,
  );
  const audit = new AuditLogService(prisma);
  stores = new StoresService(prisma, entitlements, audit);
  const unexpectedCall = () => {
    outboundQuestionCalls++;
    throw new Error('External question calls are forbidden in this test.');
  };
  const questions = new QuestionsService(
    prisma,
    { enqueue: unexpectedCall },
    { enqueue: unexpectedCall },
    { generate: unexpectedCall } as unknown as ConstructorParameters<
      typeof QuestionsService
    >[3],
    {
      getQuestionKnowledgeGaps: () => Promise.resolve([]),
    } as unknown as ConstructorParameters<typeof QuestionsService>[4],
  );
  paddle = new PaddleBillingService(
    prisma,
    subscriptions,
    new PaddleCheckoutBindingService(),
    {} as PaddleCheckoutService,
    authorization,
    {
      resolveBillingIssues: () => Promise.resolve([]),
      createWorkspaceFinanceNotification: () => Promise.resolve([]),
      emitBillingChange: () => {},
    } as unknown as NotificationsService,
    audit,
  );
  @Module({
    controllers: [
      BillingController,
      StoreBillingController,
      StoresController,
      QuestionsController,
    ],
    providers: [
      AuthGuard,
      {
        provide: AuthService,
        useValue: {
          auth: {
            api: {
              getSession: ({ headers }: { headers: Headers }) => {
                const user = sessions.get(headers.get('cookie') || '');
                return Promise.resolve(
                  user ? { user, session: { id: 'synthetic-session' } } : null,
                );
              },
            },
          },
        },
      },
      { provide: BillingEntitlementService, useValue: entitlements },
      { provide: BillingAuthorizationService, useValue: authorization },
      { provide: PaddleBillingService, useValue: paddle },
      { provide: PaddlePlanChangeService, useValue: {} },
      { provide: StoresService, useValue: stores },
      { provide: QuestionsService, useValue: questions },
    ],
  })
  class TestModule {}
  app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${((app.getHttpServer() as Server).address() as AddressInfo).port}`;
});

after(async () => {
  try {
    if (app) await app.close();
    if (prisma) await prisma.onModuleDestroy();
    if (created) await dropIsolatedDatabase(pool, name);
  } finally {
    try {
      if (pool) await pool.end();
    } finally {
      for (const key of changedKeys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  }
});

async function fixture() {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.invalid`,
      name: 'Test',
      emailVerified: true,
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      ownerId: user.id,
      name: 'Test workspace',
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  sessions.set(`test=${user.id}`, user);
  const subscription = await subscriptions.getOrCreateForWorkspace(
    workspace.id,
  );
  return { user, workspace, subscription };
}

void test('ten concurrent requests with one idempotency key charge exactly once', async () => {
  const f = await fixture();
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      usage.consumeAiQuestion(f.workspace.id, {
        idempotencyKey: 'same-request',
      }),
    ),
  );
  assert.equal(results.filter((result) => result.charged).length, 1);
  assert.equal((await usage.getCurrentForWorkspace(f.workspace.id)).used, 1);
  assert.equal(
    await prisma.billingUsageEvent.count({
      where: { workspaceId: f.workspace.id },
    }),
    1,
  );
});

void test('distinct concurrent requests cannot consume beyond the last quota unit', async () => {
  const f = await fixture();
  const current = await usage.getCurrentForWorkspace(f.workspace.id);
  await usage.consumeAiQuestion(f.workspace.id, {
    idempotencyKey: 'seed',
    quantity: current.limit - 1,
  });
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) =>
      usage.consumeAiQuestion(f.workspace.id, {
        idempotencyKey: `burst-${index}`,
      }),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  for (const result of results)
    if (result.status === 'rejected')
      assert.ok(result.reason instanceof BillingQuotaExceededException);
  assert.equal(
    (await usage.getCurrentForWorkspace(f.workspace.id)).used,
    current.limit,
  );
});

void test('usage ledger failure rolls back the counter and permits retry', async () => {
  const f = await fixture();
  // An invalid foreign-key source is not available on usage events; inject a DB trigger.
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION reject_usage_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."workspaceId" = '${f.workspace.id}' THEN RAISE EXCEPTION 'test ledger failure'; END IF; RETURN NEW; END $$`,
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER reject_usage_test BEFORE INSERT ON billing_usage_event FOR EACH ROW EXECUTE FUNCTION reject_usage_test()',
  );
  try {
    await assert.rejects(
      usage.consumeAiQuestion(f.workspace.id, { idempotencyKey: 'rollback' }),
    );
    assert.equal((await usage.getCurrentForWorkspace(f.workspace.id)).used, 0);
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER reject_usage_test ON billing_usage_event',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION reject_usage_test()');
  }
  assert.equal(
    (
      await usage.consumeAiQuestion(f.workspace.id, {
        idempotencyKey: 'rollback',
      })
    ).charged,
    true,
  );
});

void test('parallel store creation respects capacity inside the real transaction', async () => {
  const f = await fixture();
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, index) =>
      stores.create(f.user.id, { name: `Store ${index}` }),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    await prisma.store.count({ where: { workspaceId: f.workspace.id } }),
    1,
  );
});

void test('SQL scheduler access and request access agree at grace, trial and cancellation boundaries', async () => {
  const now = new Date();
  const end = new Date(now.getTime() - 30 * 60_000);
  const f = await fixture();
  for (const state of [
    {
      status: 'ACTIVE' as const,
      currentPeriodEnd: new Date(end.getTime() + 1),
      cancelAtPeriodEnd: false,
    },
    {
      status: 'ACTIVE' as const,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    },
    {
      status: 'ACTIVE' as const,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: true,
    },
    {
      status: 'PAST_DUE' as const,
      currentPeriodEnd: new Date(now.getTime() + 86400000),
      cancelAtPeriodEnd: false,
    },
    {
      status: 'TRIALING' as const,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: false,
    },
  ]) {
    const subscription = await prisma.billingSubscription.update({
      where: { id: f.subscription.id },
      data: {
        ...state,
        currentPeriodStart: new Date(now.getTime() - 31 * 86400000),
        trialEndsAt: now,
        paddleSubscriptionId: `sub_${f.workspace.id}`,
      },
    });
    const matches = await prisma.billingSubscription.count({
      where: { id: subscription.id, ...activeBillingSubscriptionWhere(now) },
    });
    assert.equal(matches === 1, hasBillingAccess(subscription, now));
  }
});

async function request(
  path: string,
  userId?: string,
  body?: unknown,
  origin = 'http://localhost:3001',
) {
  const response = await fetch(`${url}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(userId ? { cookie: `test=${userId}` } : {}),
      origin,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: unknown = await response.json();
  return { status: response.status, json };
}

void test('HTTP guards reject anonymous and cross-tenant finance/store access before provider calls', async () => {
  const a = await fixture(),
    b = await fixture();
  const store = await stores.create(b.user.id, { name: 'Private store B' });
  const routes = [
    `/workspaces/${b.workspace.id}/billing/summary`,
    `/workspaces/${b.workspace.id}/billing/invoices`,
    `/stores/${store.id}/billing/usage`,
    `/stores/${store.id}`,
  ];
  for (const route of routes) {
    assert.equal((await request(route)).status, 401);
    assert.ok([403, 404].includes((await request(route, a.user.id)).status));
  }
  const checkout = `/workspaces/${b.workspace.id}/billing/checkout`;
  assert.equal(
    (await request(checkout, a.user.id, { plan: 'STARTER', cycle: 'MONTHLY' }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        checkout,
        b.user.id,
        { plan: 'STARTER', cycle: 'MONTHLY' },
        'https://attacker.invalid',
      )
    ).status,
    403,
  );
  assert.equal(await prisma.billingCheckout.count(), 0);
  assert.equal((await request(`/stores/${store.id}`, b.user.id)).status, 200);
});

void test('store admin and workspace member cannot manage billing; workspace admin can, then loses access on removal', async () => {
  const owner = await fixture();
  const user = await prisma.user.create({
    data: {
      name: 'Delegate',
      email: `${randomUUID()}@example.invalid`,
      emailVerified: true,
    },
  });
  const delegated = { user };
  sessions.set(`test=${user.id}`, user);
  const store = await stores.create(owner.user.id, { name: 'Owner store' });
  await prisma.workspaceMember.create({
    data: {
      workspaceId: owner.workspace.id,
      userId: delegated.user.id,
      role: 'MEMBER',
    },
  });
  await prisma.storeMember.create({
    data: { storeId: store.id, userId: delegated.user.id, role: 'ADMIN' },
  });
  const path = `/workspaces/${owner.workspace.id}/billing/summary`;
  assert.equal((await request(path, delegated.user.id)).status, 403);
  await prisma.workspaceMember.update({
    where: {
      workspaceId_userId: {
        workspaceId: owner.workspace.id,
        userId: delegated.user.id,
      },
    },
    data: { role: 'ADMIN' },
  });
  assert.equal((await request(path, delegated.user.id)).status, 200);
  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: {
        workspaceId: owner.workspace.id,
        userId: delegated.user.id,
      },
    },
  });
  assert.equal((await request(path, delegated.user.id)).status, 403);
});

async function paidFixture() {
  const f = await fixture();
  const start = new Date(Date.now() - 86400000),
    end = new Date(Date.now() + 29 * 86400000);
  const subscription = await prisma.billingSubscription.update({
    where: { id: f.subscription.id },
    data: {
      status: 'ACTIVE',
      paddleSubscriptionId: `sub_${f.workspace.id}`,
      paddleCustomerId: `ctm_${f.workspace.id}`,
      paddlePriceId: 'pri_local_starter',
      currentPeriodStart: start,
      currentPeriodEnd: end,
      usagePeriodAnchor: start,
    },
  });
  return { ...f, subscription };
}

void test('question IDs remain scoped to their store; viewers cannot enqueue answers or AI drafts', async () => {
  const a = await fixture(),
    b = await fixture();
  const storeA = await stores.create(a.user.id, { name: 'A' });
  const storeB = await stores.create(b.user.id, { name: 'B' });
  const connection = await prisma.channelConnection.create({
    data: {
      storeId: storeB.id,
      providerKey: 'trendyol',
      type: 'COMMERCE',
      status: 'CONNECTED',
    },
  });
  const event = await prisma.incomingEvent.create({
    data: {
      storeId: storeB.id,
      connectionId: connection.id,
      externalEventId: randomUUID(),
      eventType: 'PRODUCT_QUESTION',
      payload: {},
      externalCreatedAt: new Date(),
    },
  });
  const question = await prisma.productQuestion.create({
    data: {
      storeId: storeB.id,
      connectionId: connection.id,
      incomingEventId: event.id,
      externalQuestionId: randomUUID(),
      externalProductId: 'test',
      question: 'Test?',
      externalCreatedAt: new Date(),
    },
  });
  assert.equal(
    (await request(`/stores/${storeB.id}/questions/${question.id}`, a.user.id))
      .status,
    404,
  );
  assert.equal(
    (await request(`/stores/${storeA.id}/questions/${question.id}`, a.user.id))
      .status,
    404,
  );
  assert.equal(
    (await request(`/stores/${storeB.id}/questions/${question.id}`, b.user.id))
      .status,
    200,
  );
  const viewer = await prisma.user.create({
    data: { name: 'Viewer', email: `${randomUUID()}@example.invalid` },
  });
  sessions.set(`test=${viewer.id}`, viewer);
  await prisma.storeMember.create({
    data: { storeId: storeB.id, userId: viewer.id, role: 'VIEWER' },
  });
  assert.equal(
    (
      await request(
        `/stores/${storeB.id}/questions/${question.id}/answer`,
        viewer.id,
        { answer: 'Should not send' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/stores/${storeB.id}/questions/${question.id}/draft`,
        viewer.id,
        {},
      )
    ).status,
    403,
  );
  assert.equal(outboundQuestionCalls, 0);
  await prisma.storeMember.delete({
    where: { storeId_userId: { storeId: storeB.id, userId: viewer.id } },
  });
  assert.equal(
    (await request(`/stores/${storeB.id}/questions/${question.id}`, viewer.id))
      .status,
    404,
  );
});

void test('unconfirmed renewal keeps exhausted quota; signed next-period snapshot opens the new allowance', async (context) => {
  context.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2028-05-15T12:00:00Z'),
  });
  const f = await paidFixture();
  const end = new Date(Date.now() - 5 * 60_000),
    start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  f.subscription = await prisma.billingSubscription.update({
    where: { id: f.subscription.id },
    data: {
      currentPeriodStart: start,
      currentPeriodEnd: end,
      usagePeriodAnchor: start,
    },
  });
  const current = await usage.getCurrentForWorkspace(f.workspace.id);
  await usage.consumeAiQuestion(f.workspace.id, {
    idempotencyKey: 'exhaust-previous',
    quantity: current.limit,
  });
  await assert.rejects(
    usage.consumeAiQuestion(f.workspace.id, {
      idempotencyKey: 'before-renewal',
    }),
    BillingQuotaExceededException,
  );
  const nextEnd = new Date(end);
  nextEnd.setUTCMonth(nextEnd.getUTCMonth() + 1);
  const body = subscriptionBody(f);
  body.data.current_billing_period = {
    starts_at: end.toISOString(),
    ends_at: nextEnd.toISOString(),
  };
  await paddle.processVerifiedWebhook(await signed(body));
  assert.equal((await usage.getCurrentForWorkspace(f.workspace.id)).used, 0);
  assert.equal(
    (
      await usage.consumeAiQuestion(f.workspace.id, {
        idempotencyKey: 'after-renewal',
      })
    ).charged,
    true,
  );
});

function subscriptionBody(
  f: Awaited<ReturnType<typeof paidFixture>>,
  options: {
    status?: string;
    updatedAt?: Date;
    price?: string;
    customer?: string;
  } = {},
) {
  return {
    event_id: `evt_${randomUUID()}`,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: f.subscription.paddleSubscriptionId,
      customer_id: options.customer || f.subscription.paddleCustomerId,
      status: options.status || 'active',
      updated_at: (options.updatedAt || new Date()).toISOString(),
      current_billing_period: {
        starts_at: f.subscription.currentPeriodStart.toISOString(),
        ends_at: f.subscription.currentPeriodEnd.toISOString(),
      },
      billing_cycle: { interval: 'month', frequency: 1 },
      items: [
        {
          quantity: 1,
          price: {
            id: options.price || 'pri_local_starter',
            billing_cycle: { interval: 'month', frequency: 1 },
            trial_period: null,
          },
        },
      ],
    },
  };
}
async function signed(body: ReturnType<typeof subscriptionBody>) {
  const raw = JSON.stringify(body),
    ts = Math.floor(Date.now() / 1000);
  const signature = `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${raw}`).digest('hex')}`;
  return paddle.verifyWebhook(raw, signature);
}

void test('real Paddle signature verification rejects tampering without any network request', async () => {
  const f = await paidFixture();
  const body = subscriptionBody(f);
  assert.equal((await signed(body)).eventId, body.event_id);
  await assert.rejects(paddle.verifyWebhook(JSON.stringify(body), undefined));
  await assert.rejects(
    paddle.verifyWebhook(
      JSON.stringify(body),
      `ts=${Math.floor(Date.now() / 1000)};h1=forged`,
    ),
  );
  assert.equal(
    await prisma.billingWebhookEvent.count({ where: { id: body.event_id } }),
    0,
  );
});

void test('duplicate and stale subscription deliveries cannot regress state or reset paid quota', async () => {
  const f = await paidFixture();
  await usage.consumeAiQuestion(f.workspace.id, {
    idempotencyKey: 'before-plan-change',
  });
  const current = await signed(
    subscriptionBody(f, {
      price: 'pri_local_growth',
      updatedAt: new Date(Date.now() + 1000),
    }),
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () => paddle.processVerifiedWebhook(current)),
  );
  assert.equal(
    results.filter((result) => 'duplicate' in result && result.duplicate)
      .length,
    4,
  );
  await paddle.processVerifiedWebhook(
    await signed(
      subscriptionBody(f, {
        status: 'past_due',
        updatedAt: new Date(Date.now() - 1000),
      }),
    ),
  );
  const saved = await prisma.billingSubscription.findUniqueOrThrow({
    where: { id: f.subscription.id },
  });
  assert.equal(saved.status, 'ACTIVE');
  assert.equal(saved.plan, 'GROWTH');
  assert.equal(
    saved.usagePeriodAnchor?.getTime(),
    f.subscription.usagePeriodAnchor?.getTime(),
  );
  assert.equal((await usage.getCurrentForWorkspace(f.workspace.id)).used, 1);
});

void test('failed subscription binding rolls back its event claim and the same event can retry', async () => {
  const f = await paidFixture();
  const body = subscriptionBody(f, { customer: 'ctm_wrong_account' });
  await assert.rejects(paddle.processVerifiedWebhook(await signed(body)));
  assert.equal(
    await prisma.billingWebhookEvent.count({ where: { id: body.event_id } }),
    0,
  );
  body.data.customer_id = f.subscription.paddleCustomerId;
  await paddle.processVerifiedWebhook(await signed(body));
  assert.equal(
    await prisma.billingWebhookEvent.count({ where: { id: body.event_id } }),
    1,
  );
});

void test('transaction payment failure records a reference without granting or revoking subscription access', async () => {
  const f = await paidFixture();
  await paddle.processVerifiedWebhook({
    eventId: `evt_${randomUUID()}`,
    eventType: 'transaction.payment_failed',
    occurredAt: new Date().toISOString(),
    data: {
      id: `txn_${randomUUID()}`,
      subscriptionId: f.subscription.paddleSubscriptionId,
      customerId: f.subscription.paddleCustomerId,
      status: 'past_due',
    },
  } as EventEntity);
  assert.equal(
    (
      await prisma.billingSubscription.findUniqueOrThrow({
        where: { id: f.subscription.id },
      })
    ).status,
    'ACTIVE',
  );
  assert.equal(
    await prisma.billingTransactionReference.count({
      where: { workspaceId: f.workspace.id },
    }),
    1,
  );
});
