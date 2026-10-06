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
};
type Where = {
  id?: string;
  storeId?: string;
  status?: string;
  draftProcessingStatus?: string | null | { in: string[] };
  draftQueuedAt?: Date | null | { lte: Date };
  store?: unknown;
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
      draftProcessingStartedAt: null,
      draftProcessingError: 'Previous quota failure',
    }),
  );
  let retryFailure = options.retryFailure ?? false;
  const retried: string[] = [];
  const added: string[] = [];
  const jobs = new Map<
    string,
    {
      data: QuestionDraftJobData;
      state: string;
      attemptsMade: number;
      attemptsStarted: number;
      getState(): Promise<string>;
      updateData(data: QuestionDraftJobData): Promise<void>;
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
    const state = where.draftProcessingStatus;
    if (state && typeof state === 'object') {
      if (!state.in.includes(question.draftProcessingStatus ?? ''))
        return false;
    } else if (
      'draftProcessingStatus' in where &&
      state !== question.draftProcessingStatus
    )
      return false;
    if (
      where.store &&
      (options.automatic === false || options.connected === false)
    )
      return false;
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
            .slice(0, input.take),
        ),
      updateMany: ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<Question>;
      }) => {
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
  return {
    service: new QuestionDraftQueueService(
      queue,
      prisma,
      billing,
      billingUsage,
    ),
    questions,
    jobs,
    retried,
    added,
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

void test('a newly queued dispatch gets a grace period and answered or processing questions are never replayed', async () => {
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
