// Async fakes retain the Promise contract of the network services they replace.
/* eslint-disable @typescript-eslint/require-await */
import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { before, after, test } from 'node:test';
import { Pool } from 'pg';
import { dropIsolatedDatabase } from '../../../test/isolated-database';
import { Queue, Worker } from 'bullmq';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BillingUsageService } from '../billing/billing-usage.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingQuotaExceededException } from '../billing/billing.errors';
import type { AiDraftResult } from '../ai/ai-draft.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DraftCapacityException,
  DraftExecutionService,
} from './draft-execution.service';
import { QuestionDraftService } from './question-draft.service';
import { QuestionDraftProcessor } from './question-draft.processor';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import type { ProductAnswerContext } from './product-answer-context.types';
import type { QuestionDraftQueueJobData } from './question-draft.types';

const databaseName = `core_assist_guards_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const previousUrl = process.env.DATABASE_URL;
let pool: Pool;
let created = false;
let prisma: PrismaService;

before(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || previousUrl || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Local PostgreSQL required.');
  pool = new Pool({ connectionString: url.toString() });
  await pool.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  url.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = url.toString();
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
});

after(async () => {
  try {
    if (prisma) await prisma.onModuleDestroy();
  } finally {
    try {
      if (
        pool &&
        created &&
        /^core_assist_guards_test_[a-f0-9]{12}$/.test(databaseName)
      ) {
        await dropIsolatedDatabase(pool, databaseName);
      }
    } finally {
      if (pool) await pool.end();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  }
});

async function fixture() {
  const user = await prisma.user.create({
    data: { name: 'Guard test', email: `${randomUUID()}@example.invalid` },
  });
  const workspace = await prisma.workspace.create({
    data: { name: 'Guards', ownerId: user.id },
  });
  const store = await prisma.store.create({
    data: { name: 'Store', workspaceId: workspace.id },
  });
  const connection = await prisma.channelConnection.create({
    data: {
      storeId: store.id,
      providerKey: 'trendyol',
      type: 'COMMERCE',
      status: 'CONNECTED',
    },
  });
  const addQuestion = async () => {
    const externalId = randomUUID();
    const event = await prisma.incomingEvent.create({
      data: {
        storeId: store.id,
        connectionId: connection.id,
        externalEventId: externalId,
        eventType: 'PRODUCT_QUESTION',
        payload: {},
        externalCreatedAt: new Date(),
      },
    });
    return prisma.productQuestion.create({
      data: {
        storeId: store.id,
        connectionId: connection.id,
        incomingEventId: event.id,
        externalQuestionId: externalId,
        externalProductId: 'test-product',
        question: 'Ürün malzemesi nedir?',
        externalCreatedAt: new Date(),
      },
    });
  };
  const subscriptions = new BillingSubscriptionService(prisma);
  const usage = new BillingUsageService(prisma, subscriptions);
  const question = await addQuestion();
  return {
    user,
    workspace,
    store,
    question,
    addQuestion,
    subscriptions,
    usage,
  };
}

const draft: AiDraftResult = {
  answer: 'Pamuk kumaştır.',
  interpretation: 'Malzeme sorusu',
  scope: 'IN_SCOPE',
  detectedFacts: ['MATERIAL'],
  answerability: 'FULL',
  decision: 'DRAFT',
  confidence: 0.98,
  usedFacts: ['MATERIAL'],
  usedEvidenceIds: ['material'],
  missingInformation: [],
  risks: [],
  source: 'GEMINI',
  model: 'test-only',
};

function generator(
  f: Awaited<ReturnType<typeof fixture>>,
  call: () => Promise<AiDraftResult | null>,
) {
  return new QuestionDraftService(
    prisma,
    {
      build: async (_storeId: string, questionId: string) =>
        ({
          questionId,
          requestedFacts: ['MATERIAL'],
          matchingVariants: [],
          matchedColor: null,
          matchedSize: null,
        }) as unknown as ProductAnswerContext,
    } as unknown as ConstructorParameters<typeof QuestionDraftService>[1],
    {} as ConstructorParameters<typeof QuestionDraftService>[2],
    { generate: call },
    new QuestionResponsePolicyService(),
    new QuestionReplyDecisionService(),
    {
      linkQuestionIfPossible: async () => false,
    } as unknown as ConstructorParameters<typeof QuestionDraftService>[6],
    f.usage,
    {
      notifyAiQuestionThreshold: async () => {},
    } as unknown as ConstructorParameters<typeof QuestionDraftService>[8],
    f.subscriptions,
    new DraftExecutionService(prisma),
  );
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

async function clearCooldown(workspaceId: string) {
  await prisma.aiDraftLease.updateMany({
    where: { workspaceId },
    data: { startedAt: new Date(Date.now() - 6000) },
  });
}

void test('10 mixed manual/automation requests on one question produce one draft and one quota unit', async () => {
  const f = await fixture();
  const entered = gate();
  const release = gate();
  let calls = 0;
  const service = generator(f, async () => {
    calls++;
    entered.open();
    await release.promise;
    return draft;
  });
  const first = service.generate(f.store.id, f.question.id);
  await entered.promise;
  const competing = await Promise.allSettled(
    Array.from({ length: 9 }, (_, i) =>
      service.generate(f.store.id, f.question.id, {
        trigger: i % 2 ? 'MANUAL' : 'AUTOMATION',
      }),
    ),
  );
  release.open();
  await first;
  assert.equal(
    competing.filter(
      (r) =>
        r.status === 'rejected' && r.reason instanceof DraftCapacityException,
    ).length,
    9,
  );
  assert.equal(calls, 1);
  assert.equal(
    await prisma.aiDraftAttempt.count({ where: { questionId: f.question.id } }),
    1,
  );
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 1);
});

void test('different questions competing for the last unit make only one paid generation', async () => {
  const f = await fixture();
  const extra = await Promise.all(
    Array.from({ length: 9 }, () => f.addQuestion()),
  );
  const subscription = await f.subscriptions.getOrCreateForWorkspace(
    f.workspace.id,
  );
  const usage = await f.usage.getCurrentForWorkspace(f.workspace.id);
  await prisma.billingUsagePeriod.create({
    data: {
      workspaceId: f.workspace.id,
      subscriptionId: subscription.id,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
      aiQuestionUnits: usage.limit - 1,
    },
  });
  const entered = gate(),
    release = gate();
  let calls = 0;
  const service = generator(f, async () => {
    calls++;
    entered.open();
    await release.promise;
    return draft;
  });
  const first = service.generate(f.store.id, f.question.id);
  await entered.promise;
  const pending = await Promise.allSettled(
    extra.map((question) => service.generate(f.store.id, question.id)),
  );
  release.open();
  await first;
  assert.equal(pending.filter((r) => r.status === 'rejected').length, 9);
  await clearCooldown(f.workspace.id);
  await assert.rejects(
    service.generate(f.store.id, extra[0].id),
    BillingQuotaExceededException,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await f.usage.getCurrentForWorkspace(f.workspace.id)).remaining,
    0,
  );
});

void test('failure releases the claim without billing; immediate requests are throttled', async () => {
  const f = await fixture();
  let calls = 0;
  let fail = true;
  const service = generator(f, async () => {
    calls++;
    if (fail) throw new Error('provider unavailable');
    return draft;
  });
  await assert.rejects(
    service.generate(f.store.id, f.question.id),
    /provider unavailable/,
  );
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 0);
  await assert.rejects(
    service.generate(f.store.id, f.question.id),
    DraftCapacityException,
  );
  assert.equal(calls, 1);
  await clearCooldown(f.workspace.id);
  fail = false;
  await service.generate(f.store.id, f.question.id);
  assert.equal(calls, 2);
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 1);
});

void test('included regenerations keep the existing billing rule under the claim', async () => {
  const f = await fixture();
  const service = generator(f, async () => draft);
  for (let i = 0; i < 4; i++) {
    await clearCooldown(f.workspace.id);
    await service.generate(f.store.id, f.question.id);
  }
  assert.equal(
    await prisma.aiDraftAttempt.count({ where: { questionId: f.question.id } }),
    4,
  );
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 2);
});

void test('lease expiry allows recovery; stale result cannot commit or release the new owner', async () => {
  const f = await fixture();
  const entered = gate(),
    release = gate();
  const service = generator(f, async () => {
    entered.open();
    await release.promise;
    return draft;
  });
  const pending = service.generate(f.store.id, f.question.id);
  const rejected = assert.rejects(pending, DraftCapacityException);
  await entered.promise;
  await prisma.aiDraftLease.update({
    where: { workspaceId: f.workspace.id },
    data: {
      expiresAt: new Date(Date.now() - 1000),
      startedAt: new Date(Date.now() - 10_000),
    },
  });
  const nextEntered = gate(),
    nextRelease = gate();
  const guard = new DraftExecutionService(prisma);
  const next = guard.run(f.store.id, f.question.id, async (lease) => {
    nextEntered.open();
    await nextRelease.promise;
    await lease.assertActive();
  });
  await nextEntered.promise;
  const owner = await prisma.aiDraftLease.findUniqueOrThrow({
    where: { workspaceId: f.workspace.id },
  });
  release.open();
  await rejected;
  const current = await prisma.aiDraftLease.findUniqueOrThrow({
    where: { workspaceId: f.workspace.id },
  });
  assert.equal(current.token, owner.token);
  assert.ok(current.expiresAt > new Date());
  assert.equal(
    await prisma.aiDraftAttempt.count({ where: { questionId: f.question.id } }),
    0,
  );
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 0);
  nextRelease.open();
  await next;
});

void test('an answer queued during generation prevents stale draft commit and billing', async () => {
  const f = await fixture();
  const entered = gate(),
    release = gate();
  const pending = generator(f, async () => {
    entered.open();
    await release.promise;
    return draft;
  }).generate(f.store.id, f.question.id);
  const rejected = assert.rejects(pending, ConflictException);
  await entered.promise;
  try {
    await prisma.questionAnswer.create({
      data: {
        storeId: f.store.id,
        connectionId: f.question.connectionId,
        questionId: f.question.id,
        answer: 'Manuel cevap',
        status: 'QUEUED',
      },
    });
  } finally {
    release.open();
  }
  await rejected;
  assert.equal(
    await prisma.aiDraftAttempt.count({ where: { questionId: f.question.id } }),
    0,
  );
  assert.equal((await f.usage.getCurrentForWorkspace(f.workspace.id)).used, 0);
  const delivery = await prisma.questionAnswer.findUniqueOrThrow({
    where: { questionId: f.question.id },
  });
  assert.equal(delivery.status, 'QUEUED');
  assert.equal(delivery.answer, 'Manuel cevap');
});

void test('a slow workspace does not block another workspace', async () => {
  const first = await fixture(),
    second = await fixture();
  const entered = gate(),
    release = gate();
  const busy = generator(first, async () => {
    entered.open();
    await release.promise;
    return draft;
  }).generate(first.store.id, first.question.id);
  await entered.promise;
  try {
    await generator(second, async () => draft).generate(
      second.store.id,
      second.question.id,
    );
  } finally {
    release.open();
  }
  await busy;
});

void test('push subscription limit is atomic and existing subscriptions remain refreshable', async () => {
  const f = await fixture();
  const notifications = new NotificationsService(
    prisma,
    {} as ConstructorParameters<typeof NotificationsService>[1],
    { browserConfigured: true } as ConstructorParameters<
      typeof NotificationsService
    >[2],
    {} as ConstructorParameters<typeof NotificationsService>[3],
    {} as ConstructorParameters<typeof NotificationsService>[4],
  );
  const ec = createECDH('prime256v1');
  ec.generateKeys();
  const keys = {
    p256dh: ec.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  const body = (i: number) => ({
    storeId: f.store.id,
    endpoint: `https://fcm.googleapis.com/fcm/send/${f.user.id}-${i}`,
    keys,
  });
  const results = await Promise.allSettled(
    Array.from({ length: 15 }, (_, i) =>
      notifications.saveWebPushSubscription(f.user.id, body(i)),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 10);
  assert.equal(
    await prisma.webPushSubscription.count({ where: { userId: f.user.id } }),
    10,
  );
  const existing = await prisma.webPushSubscription.findFirstOrThrow({
    where: { userId: f.user.id },
  });
  await notifications.saveWebPushSubscription(f.user.id, {
    ...body(0),
    endpoint: existing.endpoint,
  });
  await assert.rejects(
    notifications.saveWebPushSubscription(f.user.id, {
      ...body(99),
      endpoint: 'https://127.0.0.1/private',
    }),
  );
  await assert.rejects(
    notifications.saveWebPushSubscription(f.user.id, {
      ...body(99),
      keys: { ...keys, auth: 'bad' },
    }),
  );
});

void test('concurrent users cannot replace each other’s push subscription keys', async () => {
  const a = await fixture(),
    b = await fixture();
  const notifications = new NotificationsService(
    prisma,
    {} as ConstructorParameters<typeof NotificationsService>[1],
    { browserConfigured: true } as ConstructorParameters<
      typeof NotificationsService
    >[2],
    {} as ConstructorParameters<typeof NotificationsService>[3],
    {} as ConstructorParameters<typeof NotificationsService>[4],
  );
  const ec = createECDH('prime256v1');
  ec.generateKeys();
  const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
  const bodies = [a, b].map((f) => ({
    storeId: f.store.id,
    endpoint,
    keys: {
      p256dh: ec.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  }));
  const results = await Promise.allSettled([
    notifications.saveWebPushSubscription(a.user.id, bodies[0]),
    notifications.saveWebPushSubscription(b.user.id, bodies[1]),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const saved = await prisma.webPushSubscription.findUniqueOrThrow({
    where: { endpoint },
  });
  assert.equal(
    saved.auth,
    bodies[saved.userId === a.user.id ? 0 : 1].keys.auth,
  );
});

void test('real BullMQ capacity delay does not consume failure attempts', async () => {
  const url = new URL(
    process.env.TEST_REDIS_URL ||
      process.env.REDIS_URL ||
      'redis://127.0.0.1:6379',
  );
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Local Redis required.');
  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
  };
  const prefix = `draft-guard-test-${randomUUID()}`;
  const queue = new Queue<QuestionDraftQueueJobData>('draft-guard', {
    connection,
    prefix,
  });
  let worker: Worker | undefined;
  let runs = 0,
    deferrals = 0;
  const processor = new QuestionDraftProcessor(
    {
      run: async () => {
        if (++runs === 1) throw new DraftCapacityException();
        return {};
      },
      deferForCapacity: async () => {
        deferrals++;
      },
      markFinalFailure: async () => {
        throw new Error('Capacity contention is not final failure.');
      },
    } as unknown as ConstructorParameters<typeof QuestionDraftProcessor>[0],
    {} as ConstructorParameters<typeof QuestionDraftProcessor>[1],
  );
  try {
    await queue.waitUntilReady();
    worker = new Worker<QuestionDraftQueueJobData>(
      'draft-guard',
      (job, token) => processor.process(job, token),
      { connection, prefix },
    );
    await worker.waitUntilReady();
    const job = await queue.add(
      'GENERATE_QUESTION_DRAFT',
      { storeId: 'test', questionId: 'test' },
      { attempts: 1 },
    );
    const deadline = Date.now() + 15000;
    while ((await job.getState()) !== 'completed') {
      if (Date.now() > deadline)
        throw new Error('Delayed draft did not complete.');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(deferrals, 1);
    assert.equal(runs, 2);
    assert.equal((await queue.getJob(job.id!))?.attemptsMade, 1);
  } finally {
    if (worker) await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
