import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  AiAutomationMode,
  OperationalEmailIncidentKind,
  ProductQuestionStatus,
} from '../../generated/prisma/enums';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import { QuestionDraftWorkerService } from './question-draft-worker.service';

function createHarness() {
  const failures: Array<{ storeId: string; kind: string }> = [];
  const successes: Array<{ storeId: string; kind: string }> = [];
  const resolved: Array<{ storeId: string; kind: string }> = [];
  const prisma = {
    productQuestion: {
      findFirst: () =>
        Promise.resolve({
          status: ProductQuestionStatus.PENDING,
          answer: null,
          draftDecision: null,
          draftAttempts: [],
          answerDelivery: null,
          store: {
            knowledgeProfile: { automationMode: AiAutomationMode.SHADOW },
          },
        }),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
  };
  const drafts = {
    generate: () =>
      Promise.resolve({
        status: 'DRAFTED',
        answer: 'Taslak',
        context: { decision: 'NEEDS_REVIEW' },
      }),
  };
  const notifications = {
    createForStoreMembers: () => Promise.resolve(),
    recordOperationalFailure: (input: (typeof failures)[number]) => {
      failures.push(input);
      return Promise.resolve();
    },
    recordOperationalSuccess: (input: (typeof successes)[number]) => {
      successes.push(input);
      return Promise.resolve();
    },
    resolveOperationalWarning: (input: (typeof resolved)[number]) => {
      resolved.push(input);
      return Promise.resolve();
    },
  };
  const service = new QuestionDraftWorkerService(
    prisma as unknown as ConstructorParameters<
      typeof QuestionDraftWorkerService
    >[0],
    drafts as unknown as ConstructorParameters<
      typeof QuestionDraftWorkerService
    >[1],
    {} as ConstructorParameters<typeof QuestionDraftWorkerService>[2],
    notifications as unknown as ConstructorParameters<
      typeof QuestionDraftWorkerService
    >[3],
  );
  return { service, failures, successes, resolved };
}

const job = { storeId: 'store-1', questionId: 'question-1' };

void test('nihai AI taslak hatası mağaza olayına eklenir', async () => {
  const { service, failures } = createHarness();
  await service.markFinalFailure(job, new Error('Gemini timeout'));
  assert.deepEqual(failures, [
    { storeId: 'store-1', kind: OperationalEmailIncidentKind.AI_DRAFT },
  ]);
});

void test('kota engeli AI taslak hata maili oluşturmaz', async () => {
  const { service, failures } = createHarness();
  await service.markFinalFailure(job, new BillingQuotaExceededException(100));
  assert.deepEqual(failures, [
    { storeId: 'store-1', kind: OperationalEmailIncidentKind.AI_QUOTA_PAUSED },
  ]);
});

void test('billing access failure creates a separate warning incident', async () => {
  const { service, failures } = createHarness();
  await service.markFinalFailure(job, new BillingAccessRequiredException());
  assert.deepEqual(failures, [
    {
      storeId: 'store-1',
      kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
    },
  ]);
});

void test('başarılı AI taslağı operasyon olayının iyileşmesini başlatır', async () => {
  const { service, successes, resolved } = createHarness();
  await service.run(job);
  assert.deepEqual(successes, [
    { storeId: 'store-1', kind: OperationalEmailIncidentKind.AI_DRAFT },
  ]);
  assert.deepEqual(resolved, [
    { storeId: 'store-1', kind: OperationalEmailIncidentKind.AI_QUOTA_PAUSED },
    {
      storeId: 'store-1',
      kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
    },
  ]);
});
