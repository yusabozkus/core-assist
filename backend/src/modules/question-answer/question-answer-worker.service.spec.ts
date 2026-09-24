import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  QuestionAnswerOrigin,
  SyncEmailIncidentKind,
} from '../../generated/prisma/enums';
import { QuestionAnswerWorkerService } from './question-answer-worker.service';

function createHarness() {
  const incidents: Array<{
    storeId: string;
    connectionId: string;
    kind: SyncEmailIncidentKind;
    runId: string;
  }> = [];
  const operationalFailures: Array<{
    storeId: string;
    connectionId: string;
    kind: string;
  }> = [];
  let connectionErrors = 0;
  let updatedCount = 1;
  const prisma = {
    questionAnswer: {
      findFirst: () =>
        Promise.resolve({
          questionId: 'question-1',
          connectionId: 'connection-1',
          requestedByUserId: null,
          origin: QuestionAnswerOrigin.MANUAL,
          question: { store: { workspaceId: 'workspace-1' } },
        }),
      updateMany: () => Promise.resolve({ count: updatedCount }),
    },
    channelConnection: {
      updateMany: () => Promise.resolve({ count: 1 }),
    },
  };
  const notifications = {
    createForStoreMembers: () => Promise.resolve(),
    createChannelConnectionError: () => {
      connectionErrors += 1;
      return Promise.resolve();
    },
    recordSyncFailure: (input: (typeof incidents)[number]) => {
      incidents.push(input);
      return Promise.resolve();
    },
    recordOperationalFailure: (input: (typeof operationalFailures)[number]) => {
      operationalFailures.push(input);
      return Promise.resolve();
    },
  };
  const audit = { recordSafely: () => Promise.resolve() };
  const service = new QuestionAnswerWorkerService(
    prisma as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[0],
    {} as ConstructorParameters<typeof QuestionAnswerWorkerService>[1],
    {} as ConstructorParameters<typeof QuestionAnswerWorkerService>[2],
    {} as ConstructorParameters<typeof QuestionAnswerWorkerService>[3],
    notifications as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[4],
    {} as ConstructorParameters<typeof QuestionAnswerWorkerService>[5],
    audit as unknown as ConstructorParameters<
      typeof QuestionAnswerWorkerService
    >[6],
  );
  return {
    service,
    incidents,
    operationalFailures,
    get connectionErrors() {
      return connectionErrors;
    },
    skipUpdate() {
      updatedCount = 0;
    },
  };
}

const job = { storeId: 'store-1', answerId: 'answer-1' };

void test('cevap gönderiminde yetkilendirme hatası tek bir kanal olayı açar', async () => {
  const harness = createHarness();
  await harness.service.markFinalFailure(job, new Error('Provider status 401'));
  assert.equal(harness.connectionErrors, 1);
  assert.deepEqual(harness.incidents, [
    {
      storeId: 'store-1',
      connectionId: 'connection-1',
      kind: SyncEmailIncidentKind.AUTH,
      runId: 'answer-1',
    },
  ]);

  harness.skipUpdate();
  await harness.service.markFinalFailure(job, new Error('Provider status 401'));
  assert.equal(harness.connectionErrors, 1);
  assert.equal(harness.incidents.length, 1);
  assert.equal(harness.operationalFailures.length, 0);
});

void test('diğer cevap gönderim hataları kanal yetkilendirme maili oluşturmaz', async () => {
  const harness = createHarness();
  await harness.service.markFinalFailure(job, new Error('Provider status 500'));
  assert.equal(harness.connectionErrors, 0);
  assert.equal(harness.incidents.length, 0);
  assert.deepEqual(harness.operationalFailures, [
    {
      storeId: 'store-1',
      connectionId: 'connection-1',
      kind: 'ANSWER_DELIVERY',
    },
  ]);
});
