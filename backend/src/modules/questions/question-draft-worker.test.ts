import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { NotificationsService } from '../notifications/notifications.service';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import type { QuestionDraftService } from './question-draft.service';
import { DraftStoreInactiveException } from './draft-execution.service';
import {
  QuestionDraftWorkerService,
  type DraftWorkerAttempt,
} from './question-draft-worker.service';

function fixture() {
  const row = {
    status: 'PENDING',
    draftProcessingStatus: 'PROCESSING' as string | null,
    draftProcessingStartedAt: new Date('2026-10-06T12:00:00Z') as Date | null,
    draftQueuedAt: new Date('2026-10-06T11:59:00Z') as Date | null,
    draftProcessingError: null as string | null,
    answer: null as string | null,
    draftDecision: null as string | null,
    draftAttempts: [] as Array<{ id: string; autoSendEligible: boolean }>,
    answerDelivery: null,
    store: { status: 'ACTIVE', knowledgeProfile: { automationMode: 'SHADOW' } },
  };
  let generated = 0;
  let notified = 0;
  let answersQueued = 0;
  let beforeClaim: (() => void) | undefined;
  let onGenerate: (() => void) | undefined;
  const prisma = {
    productQuestion: {
      findFirst: () => Promise.resolve({ ...row }),
      updateMany: ({
        where,
        data,
      }: {
        where: Prisma.ProductQuestionWhereInput;
        data: Partial<typeof row>;
      }) => {
        beforeClaim?.();
        const storeFilter = where.store;
        if (storeFilter?.status === 'ACTIVE' && row.store.status !== 'ACTIVE')
          return Promise.resolve({ count: 0 });
        if (
          typeof storeFilter?.status === 'object' &&
          storeFilter.status.not === 'ACTIVE' &&
          row.store.status === 'ACTIVE'
        )
          return Promise.resolve({ count: 0 });
        if (
          where.draftQueuedAt instanceof Date &&
          where.draftQueuedAt.getTime() !== row.draftQueuedAt?.getTime()
        )
          return Promise.resolve({ count: 0 });
        if (
          where.draftProcessingStartedAt instanceof Date &&
          where.draftProcessingStartedAt.getTime() !==
            row.draftProcessingStartedAt?.getTime()
        )
          return Promise.resolve({ count: 0 });
        if (
          where.draftProcessingStatus === 'PROCESSING' &&
          row.draftProcessingStatus !== 'PROCESSING'
        )
          return Promise.resolve({ count: 0 });
        if (where.draftQueuedAt === null && row.draftQueuedAt !== null)
          return Promise.resolve({ count: 0 });
        if (
          where.draftProcessingStartedAt === null &&
          row.draftProcessingStartedAt !== null
        )
          return Promise.resolve({ count: 0 });
        if (
          where.draftProcessingStatus === null &&
          row.draftProcessingStatus !== null
        )
          return Promise.resolve({ count: 0 });
        if (
          typeof where.draftProcessingStatus === 'object' &&
          Array.isArray(where.draftProcessingStatus?.in) &&
          !where.draftProcessingStatus.in.some(
            (status) => status === row.draftProcessingStatus,
          )
        )
          return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaService;
  const drafts = {
    generate: () => {
      generated++;
      onGenerate?.();
      return Promise.resolve({ status: 'IGNORED' });
    },
  } as unknown as QuestionDraftService;
  const notifications = {
    createForStoreMembers: () => {
      notified++;
      return Promise.resolve();
    },
    recordOperationalFailure: () => {
      notified++;
      return Promise.resolve();
    },
  } as unknown as NotificationsService;
  const worker = new QuestionDraftWorkerService(
    prisma,
    drafts,
    {
      enqueue: () => {
        answersQueued++;
        return Promise.resolve();
      },
    } as unknown as QuestionAnswerDispatcher,
    notifications,
  );
  const attempt: DraftWorkerAttempt = {
    startedAt: row.draftProcessingStartedAt,
    queuedAt: row.draftQueuedAt,
  };
  return {
    row,
    attempt,
    worker,
    generated: () => generated,
    notified: () => notified,
    answersQueued: () => answersQueued,
    beforeClaim: (hook: () => void) => {
      beforeClaim = hook;
    },
    onGenerate: (hook: () => void) => {
      onGenerate = hook;
    },
  };
}
const job = { storeId: 'store', questionId: 'question' };

void test('late failure and capacity callbacks cannot overwrite a recovered or newer attempt', async () => {
  for (const callback of ['failure', 'capacity']) {
    const f = fixture();
    f.row.draftProcessingStartedAt = new Date('2026-10-06T12:30:00Z');
    f.row.draftQueuedAt = new Date('2026-10-06T12:29:00Z');
    if (callback === 'failure')
      await f.worker.markFinalFailure(
        job,
        new Error('Late old worker failure'),
        f.attempt,
      );
    else await f.worker.deferForCapacity(job, f.attempt);
    assert.equal(f.row.draftProcessingStatus, 'PROCESSING');
    assert.equal(f.row.draftProcessingError, null);
    assert.equal(f.notified(), 0);
  }
});

void test('failure and capacity changes still apply to the attempt that owns the processing marker', async () => {
  const failed = fixture();
  await failed.worker.markFinalFailure(
    job,
    new Error('Model failed'),
    failed.attempt,
  );
  assert.equal(failed.row.draftProcessingStatus, 'FAILED');
  assert.equal(failed.row.draftProcessingStartedAt, null);
  assert.equal(failed.notified(), 2);
  const deferred = fixture();
  await deferred.worker.deferForCapacity(job, deferred.attempt);
  assert.equal(deferred.row.draftProcessingStatus, 'QUEUED');
  assert.equal(deferred.row.draftProcessingStartedAt, null);
});

void test('an error before claiming cannot fail another attempt', async () => {
  const f = fixture();
  await f.worker.markFinalFailure(job, new Error('Read failed'), {
    startedAt: null,
    queuedAt: null,
  });
  assert.equal(f.row.draftProcessingStatus, 'PROCESSING');
  assert.equal(f.notified(), 0);
});

void test('a changed processing marker between read and claim skips generation', async () => {
  const f = fixture();
  f.beforeClaim(() => {
    f.row.draftProcessingStartedAt = new Date('2026-10-06T12:30:00Z');
  });
  const attempt: DraftWorkerAttempt = { startedAt: null, queuedAt: null };
  assert.deepEqual(await f.worker.run(job, attempt), { status: 'SKIPPED' });
  assert.equal(f.generated(), 0);
  assert.equal(attempt.startedAt, null);
});

void test('archived queued, processing and ready drafts are skipped without generation, delivery or failure notifications', async () => {
  for (const status of ['QUEUED', 'PROCESSING', 'DRAFTED']) {
    for (const reason of ['AUTOMATION', 'KNOWLEDGE_RESOLVED'] as const) {
      const f = fixture();
      f.row.store.status = 'INACTIVE';
      f.row.store.knowledgeProfile.automationMode = 'SAFE_AUTO';
      f.row.draftProcessingStatus = status === 'DRAFTED' ? null : status;
      if (status === 'DRAFTED') {
        f.row.status = 'DRAFTED';
        f.row.answer = 'Existing verified answer';
        f.row.draftDecision = 'READY_FOR_SEND';
        f.row.draftAttempts = [{ id: 'attempt', autoSendEligible: true }];
      }
      const attempt: DraftWorkerAttempt = { startedAt: null, queuedAt: null };
      assert.deepEqual(await f.worker.run({ ...job, reason }, attempt), {
        status: 'SKIPPED',
      });
      assert.equal(f.generated(), 0);
      assert.equal(f.answersQueued(), 0);
      assert.equal(f.notified(), 0);
      assert.equal(f.row.draftProcessingStatus, null);
      assert.equal(attempt.startedAt, null);
      assert.equal(
        f.row.answer,
        status === 'DRAFTED' ? 'Existing verified answer' : null,
      );
    }
  }
});

void test('archiving between the worker read and processing claim stops generation', async () => {
  const f = fixture();
  f.beforeClaim(() => {
    f.row.store.status = 'INACTIVE';
  });
  const attempt: DraftWorkerAttempt = { startedAt: null, queuedAt: null };
  assert.deepEqual(await f.worker.run(job, attempt), { status: 'SKIPPED' });
  assert.equal(f.generated(), 0);
  assert.equal(f.row.draftProcessingStatus, null);
});

void test('a store archived during generation is cancelled without an error or quota warning', async () => {
  const f = fixture();
  f.onGenerate(() => {
    f.row.store.status = 'INACTIVE';
    throw new DraftStoreInactiveException();
  });
  const attempt: DraftWorkerAttempt = { startedAt: null, queuedAt: null };
  assert.deepEqual(await f.worker.run(job, attempt), { status: 'SKIPPED' });
  assert.equal(f.row.draftProcessingStatus, null);
  assert.equal(f.row.draftProcessingError, null);
  assert.equal(f.notified(), 0);
});

void test('failure and capacity callbacks cannot revive archived processing jobs', async () => {
  for (const callback of ['failure', 'capacity']) {
    const f = fixture();
    f.row.store.status = 'INACTIVE';
    if (callback === 'failure')
      await f.worker.markFinalFailure(
        job,
        new Error('Provider failed after archive'),
        f.attempt,
      );
    else await f.worker.deferForCapacity(job, f.attempt);
    assert.equal(f.row.draftProcessingStatus, null);
    assert.equal(f.row.draftProcessingError, null);
    assert.equal(f.notified(), 0);
  }
});

void test('an old queued job does not reclaim processing cleared by archive and restore', async () => {
  const f = fixture();
  f.row.draftProcessingStatus = null;
  f.row.draftProcessingStartedAt = null;
  f.row.draftQueuedAt = null;
  const attempt: DraftWorkerAttempt = { startedAt: null, queuedAt: null };
  assert.deepEqual(await f.worker.run(job, attempt), { status: 'SKIPPED' });
  assert.equal(f.generated(), 0);
  assert.equal(attempt.startedAt, null);
});
