// Async fakes preserve the rejected-Promise behavior of external services.
/* eslint-disable @typescript-eslint/require-await */
import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { Pool } from 'pg';
import { dropIsolatedDatabase } from '../../../test/isolated-database';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { QuestionSyncWorkerService } from '../question-sync/question-sync-worker.service';
import { QuestionAnswerWorkerService } from './question-answer-worker.service';
import { QuestionAnswerQueueService } from './question-answer-queue.service';
import { QuestionAnswerProcessor } from './question-answer.processor';
import { resolveAnswerDeliveryReview } from './answer-delivery-review';
import type { QuestionAnswerJobData } from './question-answer.types';

const databaseName = `core_assist_delivery_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const previousUrl = process.env.DATABASE_URL;
let rootPool: Pool;
let databaseCreated = false;
let prisma: PrismaService;
const ownerId = randomUUID();
const storeId = randomUUID();
const connectionId = randomUUID();
const connection = {
  id: connectionId,
  storeId,
  providerKey: 'trendyol',
  environment: 'PRODUCTION' as const,
  credentialsEncrypted: 'fake',
  connectedAt: new Date('2026-01-01'),
};
const notifications = {
  createForStoreMembers: async () => {},
  recordOperationalSuccess: async () => {},
  recordOperationalFailure: async () => {},
  resolveOperationalWarning: async () => {},
};
const billing = {
  assertStoreAccess: async () => {},
  hasStoreAccess: async () => true,
};

before(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || previousUrl || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Delivery integration tests require local PostgreSQL.');
  }
  rootPool = new Pool({ connectionString: url.toString() });
  await rootPool.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
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
  await prisma.user.create({
    data: { id: ownerId, email: 'delivery-test@example.invalid', name: 'Test' },
  });
  const workspace = await prisma.workspace.create({
    data: { name: 'Delivery tests', ownerId },
  });
  await prisma.store.create({
    data: {
      id: storeId,
      name: 'Delivery test store',
      workspaceId: workspace.id,
    },
  });
  await prisma.channelConnection.create({
    data: { ...connection, type: 'COMMERCE', status: 'CONNECTED' },
  });
});

after(async () => {
  try {
    if (prisma) await prisma.onModuleDestroy();
  } finally {
    try {
      if (
        rootPool &&
        databaseCreated &&
        /^core_assist_delivery_test_[a-f0-9]{12}$/.test(databaseName)
      ) {
        await dropIsolatedDatabase(rootPool, databaseName);
      }
    } finally {
      if (rootPool) await rootPool.end();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  }
});

function sourceQuestion() {
  const externalId = randomUUID();
  const createdAt = new Date('2026-09-01T10:00:00.000Z');
  return {
    externalId,
    externalProductId: 'product-1',
    text: 'Ürün hakkında bilgi alabilir miyim?',
    createdAt,
    rawPayload: {
      id: externalId,
      productMainId: 'product-1',
      text: 'Ürün hakkında bilgi alabilir miyim?',
      creationDate: createdAt.getTime(),
    },
  };
}

function syncWorker(failProductLookup = false) {
  const links = {
    resolveExternalProduct: async () => {
      if (failProductLookup) {
        failProductLookup = false;
        throw new Error('injected product lookup failure');
      }
      return null;
    },
    linkQuestionIfPossible: async () => false,
  };
  return new QuestionSyncWorkerService(
    prisma,
    {} as ConstructorParameters<typeof QuestionSyncWorkerService>[1],
    {} as ConstructorParameters<typeof QuestionSyncWorkerService>[2],
    { enqueue: async () => null } as unknown as ConstructorParameters<
      typeof QuestionSyncWorkerService
    >[3],
    notifications as unknown as ConstructorParameters<
      typeof QuestionSyncWorkerService
    >[4],
    links as unknown as ConstructorParameters<
      typeof QuestionSyncWorkerService
    >[5],
    billing as unknown as ConstructorParameters<
      typeof QuestionSyncWorkerService
    >[6],
    new AuditLogService(prisma),
  );
}

async function newQuestion() {
  const result = await syncWorker()['persistQuestion'](
    connection,
    sourceQuestion(),
  );
  assert.ok(result);
  return result.id;
}

function queueHarness() {
  const jobs = new Map<
    string,
    { data: QuestionAnswerJobData; state: string }
  >();
  let failAdd = false;
  let acceptBeforeFailure = false;
  const queue = {
    add: async (
      _name: string,
      data: QuestionAnswerJobData,
      opts: { jobId: string },
    ) => {
      if (!failAdd || acceptBeforeFailure) {
        if (!jobs.has(opts.jobId))
          jobs.set(opts.jobId, { data, state: 'waiting' });
      }
      if (failAdd) throw new Error('injected Redis failure');
    },
    getJob: async (id: string) => {
      const entry = jobs.get(id);
      if (!entry) return undefined;
      return {
        getState: async () => entry.state,
        retry: async () => {
          entry.state = 'waiting';
        },
        remove: async () => {
          jobs.delete(id);
        },
      };
    },
  };
  const service = new QuestionAnswerQueueService(
    prisma,
    {
      supportsProductQuestions: () => true,
    } as unknown as ConstructorParameters<typeof QuestionAnswerQueueService>[1],
    queue as unknown as ConstructorParameters<
      typeof QuestionAnswerQueueService
    >[2],
    billing as unknown as ConstructorParameters<
      typeof QuestionAnswerQueueService
    >[3],
  );
  return {
    service,
    jobs,
    fail(accepted = false) {
      failAdd = true;
      acceptBeforeFailure = accepted;
    },
    recover() {
      failAdd = false;
    },
    enqueue(questionId: string) {
      return service.enqueue({
        storeId,
        questionId,
        requestedByUserId: ownerId,
        answer: 'Test cevabı.',
      });
    },
  };
}

function answerWorker(
  send: () => Promise<{ answeredAt: Date; externalAnswerId?: string }>,
) {
  return new QuestionAnswerWorkerService(
    prisma,
    { sendProductQuestionAnswer: send } as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[1],
    { decrypt: () => ({}) } as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[2],
    {} as ConstructorParameters<typeof QuestionAnswerWorkerService>[3],
    notifications as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[4],
    billing as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[5],
    new AuditLogService(prisma),
  );
}

function jobData(delivery: {
  id: string;
  queuedAt: Date;
}): QuestionAnswerJobData {
  return {
    storeId,
    answerId: delivery.id,
    queuedAt: delivery.queuedAt.toISOString(),
  };
}

void test('receipt survives lookup failure; retry creates exactly one question', async () => {
  const worker = syncWorker(true);
  const question = sourceQuestion();
  await assert.rejects(
    worker['persistQuestion'](connection, question),
    /injected/,
  );
  const failed = await prisma.incomingEvent.findUniqueOrThrow({
    where: {
      connectionId_externalEventId: {
        connectionId,
        externalEventId: question.externalId,
      },
    },
  });
  assert.equal(failed.processingStatus, 'FAILED');
  assert.equal(
    await prisma.productQuestion.count({
      where: { incomingEventId: failed.id },
    }),
    0,
  );
  const retry = await worker['persistQuestion'](connection, question);
  const duplicate = await worker['persistQuestion'](connection, question);
  assert.equal(retry?.isNew, true);
  assert.equal(duplicate?.id, retry?.id);
  assert.equal(duplicate?.isNew, false);
  assert.equal(
    await prisma.productQuestion.count({
      where: { incomingEventId: failed.id },
    }),
    1,
  );
});

// Real PostgreSQL triggers inject failures inside the transaction, proving that
// the question insert is rolled back when event completion cannot be committed.
for (const stage of ['question', 'event'] as const) {
  void test(`transaction rollback and retry at ${stage} write`, async () => {
    const question = sourceQuestion();
    const worker = syncWorker();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION delivery_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected transaction failure'; END $$`,
    );
    const table = stage === 'question' ? 'product_question' : 'incoming_event';
    const operation = stage === 'question' ? 'INSERT' : 'UPDATE';
    const condition =
      stage === 'event' ? `WHEN (NEW."processingStatus" = 'PROCESSED')` : '';
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER delivery_test_failure BEFORE ${operation} ON "${table}" FOR EACH ROW ${condition} EXECUTE FUNCTION delivery_test_failure()`,
    );
    try {
      await assert.rejects(worker['persistQuestion'](connection, question));
      assert.equal(
        await prisma.productQuestion.count({
          where: { externalQuestionId: question.externalId },
        }),
        0,
      );
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER delivery_test_failure ON "${table}"`,
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION delivery_test_failure()');
    }
    assert.equal(
      (await worker['persistQuestion'](connection, question))?.isNew,
      true,
    );
    assert.equal(
      (await worker['persistQuestion'](connection, question))?.isNew,
      false,
    );
  });
}

void test('concurrent duplicate events create only one question', async () => {
  const worker = syncWorker();
  for (let round = 0; round < 5; round++) {
    const question = sourceQuestion();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        worker['persistQuestion'](connection, question),
      ),
    );
    assert.equal(results.filter((result) => result?.isNew).length, 1);
    assert.equal(new Set(results.map((result) => result?.id)).size, 1);
    assert.equal(
      await prisma.incomingEvent.count({
        where: { connectionId, externalEventId: question.externalId },
      }),
      1,
    );
  }
});

void test('legacy FAILED and PENDING receipts replay from stored payload without provider fetch', async () => {
  for (const processingStatus of ['FAILED', 'PENDING'] as const) {
    const question = sourceQuestion();
    await prisma.incomingEvent.create({
      data: {
        storeId,
        connectionId,
        externalEventId: question.externalId,
        eventType: 'PRODUCT_QUESTION',
        externalCreatedAt: question.createdAt,
        payload: question.rawPayload,
        processingStatus,
      },
    });
  }
  assert.equal(
    await syncWorker()['replayStoredQuestions'](connection, false),
    2,
  );
});

void test('historical questions stay ignored through repeated delivery', async () => {
  const question = { ...sourceQuestion(), createdAt: new Date('2025-01-01') };
  assert.equal(
    await syncWorker()['persistQuestion'](connection, question),
    null,
  );
  assert.equal(
    await syncWorker()['persistQuestion'](connection, question),
    null,
  );
});

for (const accepted of [false, true]) {
  void test(`Redis failure after DB commit, accepted=${accepted}, reconciles same intention`, async () => {
    const harness = queueHarness();
    harness.fail(accepted);
    const delivery = await harness.enqueue(await newQuestion());
    assert.equal(
      (
        await prisma.questionAnswer.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
      'QUEUED',
    );
    harness.recover();
    await harness.service.reconcile();
    await harness.service.reconcile();
    const matching = [...harness.jobs.values()].filter(
      (job) => job.data.answerId === delivery.id,
    );
    assert.equal(matching.length, 1);
    assert.equal(matching[0].data.queuedAt, delivery.queuedAt.toISOString());
    let calls = 0;
    const worker = answerWorker(async () => {
      calls++;
      return { answeredAt: new Date() };
    });
    await worker.run(matching[0].data);
    assert.equal(calls, 1);
  });
}

void test('a lost Redis database is rebuilt from queued rows', async () => {
  const harness = queueHarness();
  const delivery = await harness.enqueue(await newQuestion());
  harness.jobs.clear();
  await harness.service.reconcile();
  assert.ok(
    [...harness.jobs.values()].some((job) => job.data.answerId === delivery.id),
  );
  await prisma.questionAnswer.update({
    where: { id: delivery.id },
    data: { status: 'FAILED' },
  });
});

void test('concurrent workers and duplicate jobs send only once', async () => {
  const delivery = await queueHarness().enqueue(await newQuestion());
  let calls = 0;
  const worker = answerWorker(async () => {
    calls++;
    return { answeredAt: new Date() };
  });
  await Promise.all([
    worker.run(jobData(delivery)),
    worker.run(jobData(delivery)),
  ]);
  await worker.run(jobData(delivery));
  assert.equal(calls, 1);
  assert.equal(
    (
      await prisma.questionAnswer.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
    'SENT',
  );
});

void test('real Redis: scheduler, lost enqueue, legacy job replacement and duplicate dispatch', async () => {
  const url = new URL(
    process.env.TEST_REDIS_URL ||
      process.env.REDIS_URL ||
      'redis://127.0.0.1:6379',
  );
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Local Redis required.');
  const redisConnection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
  // Never touch the application's queue or FLUSHDB; use a random test prefix.
  const prefix = `delivery-test-${randomUUID()}`;
  const queue = new Queue<QuestionAnswerJobData>('delivery-test', {
    connection: redisConnection,
    prefix,
  });
  let consumer: Worker | undefined;
  let calls = 0;
  const service = new QuestionAnswerQueueService(
    prisma,
    {
      supportsProductQuestions: () => true,
    } as unknown as ConstructorParameters<typeof QuestionAnswerQueueService>[1],
    queue,
    billing as unknown as ConstructorParameters<
      typeof QuestionAnswerQueueService
    >[3],
  );
  const worker = answerWorker(async () => {
    calls++;
    return { answeredAt: new Date() };
  });
  const processor = new QuestionAnswerProcessor(worker, service);
  try {
    await queue.waitUntilReady();
    await service.onModuleInit();
    assert.equal((await queue.getJobSchedulers()).length, 1);
    await queue.removeJobScheduler('question-answer-reconciliation');
    // A scheduler's first due job may already be waiting after its removal.
    // Drain only this random test queue before testing legacy jobs manually;
    // otherwise that job can reconcile the legacy delivery before we assert it.
    await queue.drain(true);
    const delivery = await service.enqueue({
      storeId,
      questionId: await newQuestion(),
      requestedByUserId: ownerId,
      answer: 'Redis test.',
    });
    const id = `question-answer-${delivery.id}-${delivery.queuedAt.getTime()}`;
    await (await queue.getJob(id))!.remove(); // DB committed, enqueue absent.
    await Promise.all([service.reconcile(), service.reconcile()]);
    assert.ok(await queue.getJob(id));
    // Replace with a legacy job lacking the generation fence.
    await (await queue.getJob(id))!.remove();
    await queue.add(
      'SEND_QUESTION_ANSWER',
      { storeId, answerId: delivery.id },
      { jobId: id },
    );
    consumer = new Worker<QuestionAnswerJobData>(
      'delivery-test',
      (job) => processor.process(job),
      {
        connection: redisConnection,
        prefix,
        concurrency: 2,
      },
    );
    await consumer.waitUntilReady();
    await waitUntil(
      async () => (await (await queue.getJob(id))?.getState()) === 'completed',
    );
    assert.equal(calls, 0);
    await service.reconcile(); // Completed legacy job is replaced by fenced data.
    await waitUntil(
      async () =>
        (
          await prisma.questionAnswer.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).status === 'SENT',
    );
    assert.equal(calls, 1);
    await queue.add('SEND_QUESTION_ANSWER', jobData(delivery), {
      jobId: 'duplicate',
    });
    await waitUntil(
      async () =>
        (await (await queue.getJob('duplicate'))?.getState()) === 'completed',
    );
    assert.equal(calls, 1);
  } finally {
    if (consumer) await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});

async function waitUntil(check: () => Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    if (Date.now() > deadline)
      throw new Error('Timed out waiting for delivery test.');
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

void test('provider acceptance followed by lost response requires review, never another POST', async () => {
  const harness = queueHarness();
  const questionId = await newQuestion();
  const delivery = await harness.enqueue(questionId);
  let calls = 0;
  const worker = answerWorker(async () => {
    calls++;
    throw new Error('response lost after acceptance');
  });
  await assert.rejects(worker.run(jobData(delivery)), /response lost/);
  await worker.run(jobData(delivery));
  await worker.markFinalFailure(jobData(delivery), new Error('final retry'));
  assert.equal(calls, 1);
  assert.equal(
    (
      await prisma.questionAnswer.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
    'REVIEW_REQUIRED',
  );
  await assert.rejects(harness.enqueue(questionId), /doğrulanamadı/);
});

void test('provider success followed by local commit failure is not resent', async () => {
  const delivery = await queueHarness().enqueue(await newQuestion());
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION delivery_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected sent commit failure'; END $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER delivery_test_failure BEFORE UPDATE ON "question_answer" FOR EACH ROW WHEN (NEW.status = 'SENT') EXECUTE FUNCTION delivery_test_failure()`,
  );
  let calls = 0;
  const worker = answerWorker(async () => {
    calls++;
    return { answeredAt: new Date() };
  });
  try {
    await assert.rejects(worker.run(jobData(delivery)));
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER delivery_test_failure ON "question_answer"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION delivery_test_failure()');
  }
  await worker.run(jobData(delivery));
  assert.equal(calls, 1);
  assert.equal(
    (
      await prisma.questionAnswer.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
    'REVIEW_REQUIRED',
  );
});

void test('crashed PROCESSING deliveries age into review without queueing another send', async () => {
  const harness = queueHarness();
  const delivery = await harness.enqueue(await newQuestion());
  await prisma.questionAnswer.update({
    where: { id: delivery.id },
    data: {
      status: 'PROCESSING',
      processingStartedAt: new Date(Date.now() - 16 * 60_000),
    },
  });
  harness.jobs.clear();
  await harness.service.reconcile();
  assert.equal(
    (
      await prisma.questionAnswer.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
    'REVIEW_REQUIRED',
  );
  assert.equal(
    [...harness.jobs.values()].some((job) => job.data.answerId === delivery.id),
    false,
  );
});

void test('pre-dispatch failures remain retryable; final failure is explicit', async () => {
  const harness = queueHarness();
  const delivery = await harness.enqueue(await newQuestion());
  const worker = answerWorker(async () => {
    throw new Error('must not send');
  });
  await prisma.channelConnection.update({
    where: { id: connectionId },
    data: { status: 'ERROR' },
  });
  try {
    const processor = new QuestionAnswerProcessor(worker, harness.service);
    const job = {
      name: 'SEND_QUESTION_ANSWER',
      data: jobData(delivery),
      opts: { attempts: 3 },
      attemptsMade: 2,
    };
    await assert.rejects(
      processor.process(job as Parameters<typeof processor.process>[0]),
      /not active/,
    );
    assert.equal(
      (
        await prisma.questionAnswer.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
      'FAILED',
    );
  } finally {
    await prisma.channelConnection.update({
      where: { id: connectionId },
      data: { status: 'CONNECTED' },
    });
  }
});

for (const resolution of ['sent', 'not-sent'] as const) {
  void test(`operator resolution ${resolution} is audited; old jobs cannot act on a new attempt`, async () => {
    const harness = queueHarness();
    const questionId = await newQuestion();
    const delivery = await harness.enqueue(questionId);
    await prisma.questionAnswer.update({
      where: { id: delivery.id },
      data: { status: 'REVIEW_REQUIRED' },
    });
    const audit = new AuditLogService(prisma);
    const result = await resolveAnswerDeliveryReview(prisma, audit, {
      answerId: delivery.id,
      resolution,
      operator: 'Integration test',
      note: 'Synthetic marketplace evidence',
    });
    assert.equal(result.status, resolution === 'sent' ? 'SENT' : 'FAILED');
    assert.equal(
      await prisma.auditLog.count({
        where: {
          targetId: questionId,
          action: 'QUESTION_ANSWER_DELIVERY_REVIEWED',
        },
      }),
      1,
    );
    await assert.rejects(
      resolveAnswerDeliveryReview(prisma, audit, {
        answerId: delivery.id,
        resolution,
        operator: 'Test',
        note: 'Duplicate',
      }),
    );
    if (resolution === 'not-sent') {
      const retried = await harness.enqueue(questionId);
      assert.notEqual(retried.queuedAt.getTime(), delivery.queuedAt.getTime());
      let calls = 0;
      const worker = answerWorker(async () => {
        calls++;
        return { answeredAt: new Date() };
      });
      await worker.run(jobData(delivery));
      await worker.markFinalFailure(
        jobData(delivery),
        new Error('old final attempt'),
      );
      await worker.run({ storeId, answerId: delivery.id });
      assert.equal(calls, 0);
      assert.equal(
        (
          await prisma.questionAnswer.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).status,
        'QUEUED',
      );
      await worker.run(jobData(retried));
      assert.equal(calls, 1);
    }
  });
}

for (const invalidated of [false, true]) {
  void test(`SAFE_AUTO revalidation before dispatch, invalidated=${invalidated}`, async () => {
    const questionId = await newQuestion();
    await prisma.storeKnowledgeProfile.upsert({
      where: { storeId },
      create: { storeId, automationMode: 'SAFE_AUTO' },
      update: { automationMode: 'SAFE_AUTO' },
    });
    const answer = 'Bu konuda bilgi veremiyoruz.';
    await prisma.productQuestion.update({
      where: { id: questionId },
      data: {
        status: 'DRAFTED',
        answer,
        draftDecision: 'READY_FOR_SEND',
        draftRisks: [],
        draftMissingInformation: [],
        draftEvidenceIds: [],
      },
    });
    const draft = await prisma.aiDraftAttempt.create({
      data: {
        storeId,
        questionId,
        trigger: 'AUTOMATION',
        answer,
        decision: 'READY_FOR_SEND',
        confidence: 1,
        answerability: 'OUT_OF_SCOPE',
        risks: [],
        missingInformation: [],
        evidenceIds: [],
        model: 'test-no-network',
        automationMode: 'SAFE_AUTO',
        autoSendEligible: true,
      },
    });
    const harness = queueHarness();
    const delivery = await harness.service.enqueue({
      storeId,
      questionId,
      origin: 'AUTOMATION',
      answer,
      draftAttemptId: draft.id,
    });
    if (invalidated)
      await prisma.storeKnowledgeProfile.update({
        where: { storeId },
        data: { automationMode: 'OFF' },
      });
    let calls = 0;
    await answerWorker(async () => {
      calls++;
      return { answeredAt: new Date() };
    }).run(jobData(delivery));
    assert.equal(calls, invalidated ? 0 : 1);
    assert.equal(
      (
        await prisma.questionAnswer.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
      invalidated ? 'FAILED' : 'SENT',
    );
    assert.equal(
      (
        await prisma.aiDraftAttempt.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).outcome,
      invalidated ? 'AVAILABLE' : 'SENT',
    );
  });
}

void test('upgrade quarantines previously attempted deliveries while preserving untouched queue and sent rows', async () => {
  const cases = [
    { status: 'QUEUED', attempts: 0, expected: 'QUEUED' },
    { status: 'FAILED', attempts: 0, expected: 'FAILED' },
    { status: 'QUEUED', attempts: 1, expected: 'REVIEW_REQUIRED' },
    { status: 'FAILED', attempts: 3, expected: 'REVIEW_REQUIRED' },
    { status: 'PROCESSING', attempts: 0, expected: 'REVIEW_REQUIRED' },
    { status: 'SENT', attempts: 1, expected: 'SENT' },
  ] as const;
  const rows: Array<{ id: string; expected: string }> = [];
  for (const entry of cases) {
    const delivery = await queueHarness().enqueue(await newQuestion());
    await prisma.questionAnswer.update({
      where: { id: delivery.id },
      data: { status: entry.status, attempts: entry.attempts },
    });
    rows.push({ id: delivery.id, expected: entry.expected });
  }
  const migration = readFileSync(
    'prisma/migrations/20260927001500_quarantine_legacy_answer_attempts/migration.sql',
    'utf8',
  );
  await prisma.$executeRawUnsafe(migration);
  for (const row of rows) {
    assert.equal(
      (await prisma.questionAnswer.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
      row.expected,
    );
  }
});
