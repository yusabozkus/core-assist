import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../database/prisma.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import type { BillingSubscriptionService } from '../billing/billing-subscription.service';
import type { BillingUsageService } from '../billing/billing-usage.service';
import type { Prisma } from '../../generated/prisma/client';
import type { DraftExecutionService } from './draft-execution.service';
import { QuestionDraftQueueService } from './question-draft-queue.service';
import type {
  QuestionDraftJobData,
  QuestionDraftQueueJobData,
} from './question-draft.types';

type Question = {
  id: string;
  storeId: string;
  status: string;
  draftProcessingStatus: string | null;
  draftQueuedAt: Date | null;
  draftProcessingStartedAt: Date | null;
  draftProcessingError: string | null;
  productId: string | null;
  updatedAt: Date;
  connection: { status: string };
  answerDelivery: { status: string } | null;
  store: {
    workspaceId: string;
    status: string;
    knowledgeProfile: { automationMode: string };
  };
};
type Where = {
  id?: string;
  storeId?: string;
  status?: string;
  productId?: string | null | { not: null };
  draftProcessingStatus?: string | null | { in: string[] };
  draftQueuedAt?: Date | null | { lte: Date };
  draftProcessingStartedAt?: Date | null | { lte: Date };
  updatedAt?: Date | { lte: Date };
  store?: {
    workspaceId?: string;
    status?: string;
    knowledgeProfile?: {
      automationMode?: string | { in: string[] };
      is?: null;
    };
  };
  connection?: { status: string };
  answerDelivery?: { status?: string; is?: null };
  OR?: Where[];
};

function fixture(
  options: {
    count?: number;
    processingStatus?: string;
    jobState?: string;
    remaining?: number;
    access?: boolean;
    automatic?: boolean;
    connected?: boolean;
    retryFailure?: boolean;
    processingAgeMs?: number;
    activeLease?: boolean;
    archived?: boolean;
    answerStatus?: string;
    hasProduct?: boolean;
  } = {},
) {
  const questions: Question[] = Array.from(
    { length: options.count ?? 1 },
    (_, index) => ({
      id: `q-${String(index).padStart(3, '0')}`,
      storeId: 'store',
      status: 'PENDING',
      draftProcessingStatus: options.processingStatus ?? 'BLOCKED_QUOTA',
      draftQueuedAt: new Date(Date.now() - 120_000),
      draftProcessingStartedAt:
        options.processingStatus === 'PROCESSING'
          ? new Date(Date.now() - (options.processingAgeMs ?? 0))
          : null,
      draftProcessingError: 'Previous quota failure',
      productId: options.hasProduct === false ? null : 'product',
      updatedAt: new Date(Date.now() - (options.processingAgeMs ?? 0)),
      connection: {
        status: options.connected === false ? 'DISCONNECTED' : 'CONNECTED',
      },
      answerDelivery: options.answerStatus
        ? { status: options.answerStatus }
        : null,
      store: {
        workspaceId: 'workspace',
        status: options.archived ? 'INACTIVE' : 'ACTIVE',
        knowledgeProfile: {
          automationMode: options.automatic === false ? 'OFF' : 'SHADOW',
        },
      },
    }),
  );
  let retryFailure = options.retryFailure ?? false;
  const retried: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  let beforeRecovery: (() => void) | undefined;
  let beforeUpdate: (() => void) | undefined;
  const jobs = new Map<
    string,
    {
      data: QuestionDraftJobData;
      state: string;
      attemptsMade: number;
      attemptsStarted: number;
      getState(): Promise<string>;
      updateData(data: QuestionDraftJobData): Promise<void>;
      remove(): Promise<void>;
      retry(
        state: string,
        reset: { resetAttemptsMade: boolean; resetAttemptsStarted: boolean },
      ): Promise<void>;
    }
  >();
  function makeJob(question: Question, state: string) {
    const job = {
      data: {
        storeId: question.storeId,
        questionId: question.id,
        reason: 'AUTOMATION' as const,
      } as QuestionDraftJobData,
      state,
      attemptsMade: 3,
      attemptsStarted: 3,
      getState: () => Promise.resolve(job.state),
      updateData: (data: QuestionDraftJobData) => {
        job.data = data;
        return Promise.resolve();
      },
      remove: () => {
        if (job.state === 'active')
          return Promise.reject(new Error('Job is locked'));
        jobs.delete(`question-draft-${question.id}`);
        removed.push(question.id);
        return Promise.resolve();
      },
      retry: (
        expected: string,
        reset: { resetAttemptsMade: boolean; resetAttemptsStarted: boolean },
      ) => {
        if (retryFailure) return Promise.reject(new Error('Redis unavailable'));
        assert.equal(job.state, expected);
        job.state = 'waiting';
        if (reset.resetAttemptsMade) job.attemptsMade = 0;
        if (reset.resetAttemptsStarted) job.attemptsStarted = 0;
        retried.push(question.id);
        return Promise.resolve();
      },
    };
    jobs.set(`question-draft-${question.id}`, job);
    return job;
  }
  if (options.jobState !== 'missing')
    for (const question of questions)
      makeJob(question, options.jobState ?? 'failed');
  const matches = (question: Question, where: Where): boolean => {
    if (where.id && where.id !== question.id) return false;
    if (where.storeId && where.storeId !== question.storeId) return false;
    if (where.status && where.status !== question.status) return false;
    if ('productId' in where) {
      if (where.productId && typeof where.productId === 'object') {
        if (question.productId === null) return false;
      } else if (where.productId !== question.productId) return false;
    }
    const state = where.draftProcessingStatus;
    if (state && typeof state === 'object') {
      if (!state.in.includes(question.draftProcessingStatus ?? ''))
        return false;
    } else if (
      'draftProcessingStatus' in where &&
      state !== question.draftProcessingStatus
    )
      return false;
    if (where.store?.status && question.store.status !== where.store.status)
      return false;
    if (
      where.store?.workspaceId &&
      question.store.workspaceId !== where.store.workspaceId
    )
      return false;
    const mode = where.store?.knowledgeProfile?.automationMode;
    if (mode) {
      if (typeof mode === 'object') {
        if (!mode.in.includes(question.store.knowledgeProfile.automationMode))
          return false;
      } else if (question.store.knowledgeProfile.automationMode !== mode)
        return false;
    }
    if (where.answerDelivery?.is === null && question.answerDelivery)
      return false;
    if (
      where.answerDelivery?.status &&
      question.answerDelivery?.status !== where.answerDelivery.status
    )
      return false;
    if (
      where.connection &&
      question.connection.status !== where.connection.status
    )
      return false;
    for (const field of ['draftProcessingStartedAt', 'updatedAt'] as const) {
      if (!(field in where)) continue;
      const condition = where[field];
      const value = question[field];
      if (condition === null && value !== null) return false;
      if (condition instanceof Date && value?.getTime() !== condition.getTime())
        return false;
      if (
        condition &&
        !(condition instanceof Date) &&
        (!value || value > condition.lte)
      )
        return false;
    }
    if ('draftQueuedAt' in where) {
      if (where.draftQueuedAt === null && question.draftQueuedAt !== null)
        return false;
      if (
        where.draftQueuedAt instanceof Date &&
        question.draftQueuedAt?.getTime() !== where.draftQueuedAt.getTime()
      )
        return false;
      if (
        where.draftQueuedAt &&
        !(where.draftQueuedAt instanceof Date) &&
        (!question.draftQueuedAt ||
          question.draftQueuedAt > where.draftQueuedAt.lte)
      )
        return false;
    }
    if (where.OR && !where.OR.some((item) => matches(question, item)))
      return false;
    return true;
  };
  const prisma = {
    store: {
      findMany: () =>
        Promise.resolve(
          questions.some((question) =>
            ['BLOCKED_QUOTA', 'BLOCKED_SUBSCRIPTION'].includes(
              question.draftProcessingStatus ?? '',
            ),
          ) && options.automatic !== false
            ? [{ id: 'store', workspaceId: 'workspace' }]
            : [],
        ),
    },
    productQuestion: {
      findMany: (input: {
        where: Where;
        take: number;
        cursor?: { id: string };
        skip?: number;
      }) =>
        Promise.resolve(
          questions
            .filter(
              (question) =>
                matches(question, input.where) &&
                (!input.cursor || question.id > input.cursor.id),
            )
            .slice(0, input.take)
            .map((question) => ({ ...question })),
        ),
      findFirst: ({ where }: { where: Where }) =>
        Promise.resolve(questions.find((question) => matches(question, where))),
      updateMany: ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<Question>;
      }) => {
        beforeUpdate?.();
        const matched = questions.filter((question) =>
          matches(question, where),
        );
        for (const question of matched) Object.assign(question, data);
        return Promise.resolve({ count: matched.length });
      },
    },
  } as unknown as PrismaService;
  const queue = {
    getJob: (id: string) => Promise.resolve(jobs.get(id)),
    add: (
      _name: string,
      data: QuestionDraftJobData,
      opts: { jobId: string },
    ) => {
      // BullMQ keeps an existing terminal job when add receives the same ID.
      if (jobs.has(opts.jobId)) return Promise.resolve(jobs.get(opts.jobId));
      added.push(data.questionId);
      const question = questions.find((item) => item.id === data.questionId)!;
      const job = makeJob(question, 'waiting');
      job.data = data;
      return Promise.resolve(job);
    },
  } as unknown as Queue<QuestionDraftQueueJobData>;
  const assertAccess = () =>
    options.access === false
      ? Promise.reject(new BillingAccessRequiredException())
      : Promise.resolve();
  const billing = {
    hasStoreAccess: () => Promise.resolve(options.access !== false),
    assertStoreAccess: assertAccess,
  } as unknown as BillingSubscriptionService;
  const billingUsage = {
    getCurrentForWorkspace: () =>
      Promise.resolve({ remaining: options.remaining ?? 1000 }),
    assertDraftGenerationAvailableForStore: () =>
      options.remaining === 0
        ? Promise.reject(new BillingQuotaExceededException(100))
        : Promise.resolve(),
  } as unknown as BillingUsageService;
  const executions = {
    recoverAbandonedProcessing: async (
      _workspaceId: string,
      _questionId: string,
      restore: (tx: Prisma.TransactionClient) => Promise<boolean>,
    ) => {
      if (options.activeLease) return false;
      beforeRecovery?.();
      return restore(prisma);
    },
  } as unknown as DraftExecutionService;
  return {
    service: new QuestionDraftQueueService(
      queue,
      prisma,
      billing,
      billingUsage,
      executions,
    ),
    questions,
    jobs,
    retried,
    added,
    removed,
    beforeRecovery: (hook: () => void) => {
      beforeRecovery = hook;
    },
    beforeUpdate: (hook: () => void) => {
      beforeUpdate = hook;
    },
    restoreRedis: () => {
      retryFailure = false;
    },
  };
}

void test('upgrading after the trial quota restarts all 20 retained failures rather than only changing the UI state', async () => {
  const state = fixture({ count: 20 });
  await state.service.resumeBillingBlockedDrafts();
  assert.equal(state.retried.length, 20);
  assert.equal(state.added.length, 0);
  assert.ok(
    state.questions.every(
      (question) => question.draftProcessingStatus === 'QUEUED',
    ),
  );
  assert.ok(
    [...state.jobs.values()].every(
      (job) =>
        job.state === 'waiting' &&
        job.attemptsMade === 0 &&
        job.attemptsStarted === 0,
    ),
  );
  await state.service.resumeBillingBlockedDrafts();
  assert.equal(
    state.retried.length,
    20,
    'another sweep cannot restart a live job',
  );
});

void test('already stranded queued questions recover both failed jobs and missing Redis dispatches', async () => {
  for (const jobState of ['failed', 'missing', 'completed']) {
    const state = fixture({ processingStatus: 'QUEUED', jobState });
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.jobs.get('question-draft-q-000')?.state, 'waiting');
    assert.equal(state.questions[0].draftProcessingStatus, 'QUEUED');
    assert.equal(state.retried.length + state.added.length, 1);
  }
});

void test('reconciliation leaves waiting, active, delayed and prioritized jobs untouched', async () => {
  for (const jobState of [
    'waiting',
    'active',
    'delayed',
    'prioritized',
    'waiting-children',
  ]) {
    const state = fixture({ processingStatus: 'QUEUED', jobState });
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.retried.length + state.added.length, 0);
    assert.equal(state.jobs.get('question-draft-q-000')?.state, jobState);
  }
});

void test('new queued and processing attempts get a grace period and answered questions are never replayed', async () => {
  const fresh = fixture({ processingStatus: 'QUEUED', jobState: 'missing' });
  fresh.questions[0].draftQueuedAt = new Date();
  await fresh.service.resumeBillingBlockedDrafts();
  assert.equal(fresh.added.length, 0);
  const answered = fixture({ processingStatus: 'QUEUED' });
  answered.questions[0].status = 'ANSWERED';
  await answered.service.resumeBillingBlockedDrafts();
  assert.equal(answered.retried.length, 0);
  const processing = fixture({ processingStatus: 'PROCESSING' });
  await processing.service.resumeBillingBlockedDrafts();
  assert.equal(processing.retried.length, 0);
});

void test('abandoned processing questions recover missing, terminal and orphaned Redis jobs', async () => {
  for (const jobState of ['missing', 'failed', 'completed', 'unknown']) {
    const f = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 60 * 60_000,
      jobState,
    });
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(f.questions[0].draftProcessingStatus, 'QUEUED');
    assert.equal(f.questions[0].draftProcessingStartedAt, null);
    assert.equal(f.jobs.get('question-draft-q-000')!.state, 'waiting');
    assert.equal(f.retried.length + f.added.length, 1);
    if (jobState === 'unknown') assert.equal(f.removed.length, 1);
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(f.retried.length + f.added.length, 1);
  }
});

void test('an old processing marker cannot restart a live Redis job or DB lease', async () => {
  for (const jobState of [
    'active',
    'waiting',
    'delayed',
    'prioritized',
    'waiting-children',
  ]) {
    const f = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 60 * 60_000,
      jobState,
    });
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(f.questions[0].draftProcessingStatus, 'PROCESSING');
    assert.equal(f.retried.length + f.added.length, 0);
  }
  const f = fixture({
    processingStatus: 'PROCESSING',
    processingAgeMs: 60 * 60_000,
    jobState: 'missing',
    activeLease: true,
  });
  await f.service.resumeBillingBlockedDrafts();
  assert.equal(f.questions[0].draftProcessingStatus, 'PROCESSING');
  assert.equal(f.added.length, 0);
});

void test('processing recovery rechecks the observed attempt after a newer worker or manual answer wins', async () => {
  for (const change of ['new-attempt', 'answered']) {
    const f = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 60 * 60_000,
      jobState: 'missing',
    });
    f.beforeRecovery(() => {
      if (change === 'new-attempt')
        f.questions[0].draftProcessingStartedAt = new Date();
      else f.questions[0].status = 'ANSWERED';
    });
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(f.retried.length + f.added.length, 0);
    assert.equal(f.questions[0].draftProcessingStatus, 'PROCESSING');
  }
});

void test('a store, connection, automation or delivery change during restoration prevents requeueing', async () => {
  const changes: Array<(question: Question) => void> = [
    (question) => {
      question.store.status = 'INACTIVE';
    },
    (question) => {
      question.connection.status = 'DISCONNECTED';
    },
    (question) => {
      question.store.knowledgeProfile.automationMode = 'OFF';
    },
    (question) => {
      question.answerDelivery = { status: 'PROCESSING' };
    },
  ];
  for (const change of changes) {
    const state = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 10 * 60_000,
      jobState: 'missing',
    });
    state.beforeUpdate(() => change(state.questions[0]));
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.questions[0].draftProcessingStatus, 'PROCESSING');
    assert.equal(state.added.length + state.retried.length, 0);
    state.beforeUpdate(() => {});
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.questions[0].draftProcessingStatus, 'FAILED');
    assert.equal(state.added.length + state.retried.length, 0);
  }
});

void test('expired processing jobs become quota/subscription blocked instead of bypassing billing', async () => {
  for (const option of [{ remaining: 0 }, { access: false }]) {
    const f = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 60 * 60_000,
      jobState: 'missing',
      ...option,
    });
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(
      f.questions[0].draftProcessingStatus,
      'remaining' in option ? 'BLOCKED_QUOTA' : 'BLOCKED_SUBSCRIPTION',
    );
    assert.equal(f.questions[0].draftProcessingStartedAt, null);
    assert.equal(f.retried.length + f.added.length, 0);
  }
});

void test('ineligible abandoned processing jobs stop displaying as running without scheduling AI', async () => {
  for (const option of [
    { automatic: false },
    { connected: false },
    { archived: true },
    { hasProduct: false },
    { answerStatus: 'PROCESSING' },
    { answerStatus: 'REVIEW_REQUIRED' },
  ]) {
    const f = fixture({
      processingStatus: 'PROCESSING',
      processingAgeMs: 60 * 60_000,
      jobState: 'missing',
      ...option,
    });
    await f.service.resumeBillingBlockedDrafts();
    assert.equal(f.questions[0].draftProcessingStatus, 'FAILED');
    assert.equal(f.questions[0].draftProcessingStartedAt, null);
    assert.equal(f.retried.length + f.added.length, 0);
  }
});

void test('an explicit knowledge retry preserves intent and requester with automation off', async () => {
  const f = fixture({
    processingStatus: 'PROCESSING',
    processingAgeMs: 60 * 60_000,
    automatic: false,
  });
  const job = f.jobs.get('question-draft-q-000')!;
  job.data.reason = 'KNOWLEDGE_RESOLVED';
  job.data.requestedByUserId = 'requester';
  await f.service.resumeBillingBlockedDrafts();
  assert.equal(f.retried.length, 1);
  assert.equal(job.data.reason, 'KNOWLEDGE_RESOLVED');
  assert.equal(job.data.requestedByUserId, 'requester');
});

void test('a dispatch failure after processing recovery remains queued and is repaired next time', async () => {
  const f = fixture({
    processingStatus: 'PROCESSING',
    processingAgeMs: 60 * 60_000,
    retryFailure: true,
    automatic: false,
  });
  f.jobs.get('question-draft-q-000')!.data.reason = 'KNOWLEDGE_RESOLVED';
  await f.service.resumeBillingBlockedDrafts();
  assert.equal(f.questions[0].draftProcessingStatus, 'QUEUED');
  assert.equal(f.retried.length, 0);
  f.questions[0].draftQueuedAt = new Date(Date.now() - 120_000);
  f.restoreRedis();
  await f.service.resumeBillingBlockedDrafts();
  assert.equal(f.retried.length, 1);
});

void test('processing recovery handles legacy null timestamps and scans beyond one batch', async () => {
  const f = fixture({
    count: 120,
    processingStatus: 'PROCESSING',
    processingAgeMs: 60 * 60_000,
    jobState: 'missing',
  });
  f.questions[0].draftProcessingStartedAt = null;
  f.questions[0].draftQueuedAt = new Date(Date.now() - 60 * 60_000);
  f.questions[1].draftProcessingStartedAt = null;
  f.questions[1].draftQueuedAt = null;
  await f.service.resumeBillingBlockedDrafts();
  assert.equal(f.added.length, 120);
  assert.ok(
    f.questions.every(
      (question) => question.draftProcessingStatus === 'QUEUED',
    ),
  );
});

void test('recovery cannot bypass a still-exhausted quota or inactive subscription', async () => {
  for (const options of [{ remaining: 0 }, { access: false }]) {
    const state = fixture({ processingStatus: 'QUEUED', ...options });
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.retried.length + state.added.length, 0);
    assert.equal(
      state.questions[0].draftProcessingStatus,
      'remaining' in options ? 'BLOCKED_QUOTA' : 'BLOCKED_SUBSCRIPTION',
    );
  }
  const disabled = fixture({
    processingStatus: 'PROCESSING',
    processingAgeMs: 10 * 60_000,
    jobState: 'missing',
    remaining: 0,
  });
  disabled.beforeRecovery(() => {
    disabled.questions[0].store.knowledgeProfile.automationMode = 'OFF';
  });
  await disabled.service.resumeBillingBlockedDrafts();
  assert.equal(disabled.questions[0].draftProcessingStatus, 'FAILED');
  assert.equal(disabled.added.length + disabled.retried.length, 0);
});

void test('manual automation and disconnected questions are not resurrected', async () => {
  for (const options of [{ automatic: false }, { connected: false }]) {
    const state = fixture({ processingStatus: 'QUEUED', ...options });
    await state.service.resumeBillingBlockedDrafts();
    assert.equal(state.retried.length + state.added.length, 0);
  }
});

void test('a transient Redis failure preserves the queued outbox and a later sweep repairs it', async () => {
  const state = fixture({ processingStatus: 'QUEUED', retryFailure: true });
  await state.service.resumeBillingBlockedDrafts();
  assert.equal(state.questions[0].draftProcessingStatus, 'QUEUED');
  assert.equal(state.retried.length, 0);
  state.restoreRedis();
  await state.service.resumeBillingBlockedDrafts();
  assert.equal(state.retried.length, 1);
});

void test('reconciliation pages past a full batch instead of starving later queued questions', async () => {
  const state = fixture({
    count: 120,
    processingStatus: 'QUEUED',
    jobState: 'missing',
  });
  await state.service.resumeBillingBlockedDrafts();
  assert.equal(state.added.length, 120);
});

void test('an explicit knowledge retry retains the new reason and requester instead of the old automation data', async () => {
  const state = fixture();
  await state.service.enqueue('store', 'q-000', {
    reason: 'KNOWLEDGE_RESOLVED',
    requestedByUserId: 'requester',
  });
  assert.deepEqual(state.jobs.get('question-draft-q-000')?.data, {
    storeId: 'store',
    questionId: 'q-000',
    reason: 'KNOWLEDGE_RESOLVED',
    requestedByUserId: 'requester',
  });
  assert.equal(state.retried.length, 1);
});

void test('archived stores cannot enqueue a new draft or become billing-blocked', async () => {
  for (const options of [
    { remaining: 100 },
    { remaining: 0 },
    { access: false },
  ]) {
    const state = fixture({
      archived: true,
      processingStatus: 'FAILED',
      jobState: 'missing',
      ...options,
    });
    await state.service.enqueue('store', 'q-000');
    assert.equal(state.questions[0].draftProcessingStatus, 'FAILED');
    assert.equal(state.added.length + state.retried.length, 0);
  }
});
