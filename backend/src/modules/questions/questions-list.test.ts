import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaService } from '../../database/prisma.service';
import { QuestionsService } from './questions.service';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import type { QuestionDraftService } from './question-draft.service';
import type { ProductKnowledgeService } from './product-knowledge.service';
import {
  ALL_PENDING_QUESTION_STATES,
  PendingQuestionStateFilter as State,
  QuestionListQueryDto,
  QuestionListStatusFilter as Status,
} from './dto/question-list-query.dto';

type Row = Record<string, unknown>;

// Exercise the service's real Prisma predicates without touching development DB.
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (value as Row[]).every((w) => matches(row, w));
    if (key === 'OR') return (value as Row[]).some((w) => matches(row, w));
    if (key === 'NOT') return !matches(row, value as Row);
    if (value && typeof value === 'object') {
      const condition = value as Row;
      if ('in' in condition)
        return (condition.in as unknown[]).includes(row[key]);
      if ('contains' in condition) {
        const field = row[key];
        return (
          typeof field === 'string' &&
          typeof condition.contains === 'string' &&
          field.toLowerCase().includes(condition.contains.toLowerCase())
        );
      }
      if ('is' in condition) {
        return condition.is === null
          ? row[key] === null
          : !!row[key] && matches(row[key] as Row, condition.is as Row);
      }
      return !!row[key] && matches(row[key] as Row, condition);
    }
    return row[key] === value;
  });
}

function fixture(authorized = true) {
  const base = {
    storeId: 'store-a',
    status: 'DRAFTED',
    draftDecision: 'NEEDS_REVIEW',
    draftProcessingStatus: null,
    answerDelivery: null,
    customerName: 'Müşteri',
    question: 'Kargo hangisi?',
    product: null,
    productTitleSnapshot: null,
    productImageUrlSnapshot: null,
    externalProductId: 'sku-1',
    connection: { providerKey: 'trendyol' },
  };
  const rows = [
    { ...base, id: 'review-a' },
    { ...base, id: 'review-b', answerDelivery: { status: 'FAILED' } },
    { ...base, id: 'review-size', question: 'Beden kaç?' },
    { ...base, id: 'other-store', storeId: 'store-b' },
    { ...base, id: 'waiting', status: 'PENDING', draftDecision: null },
    { ...base, id: 'ready', draftDecision: 'READY_FOR_SEND' },
    { ...base, id: 'queued', draftProcessingStatus: 'QUEUED' },
    { ...base, id: 'sending', answerDelivery: { status: 'PROCESSING' } },
    { ...base, id: 'answered', status: 'ANSWERED' },
    { ...base, id: 'ignored', status: 'IGNORED' },
  ];
  const calls = { list: 0, group: 0, count: 0 };
  const prisma = {
    storeMember: {
      findFirst: () => Promise.resolve(authorized ? { role: 'OWNER' } : null),
    },
    productQuestion: {
      findMany: ({
        where,
        take,
        cursor,
      }: {
        where: Row;
        take: number;
        cursor?: { id: string };
      }) => {
        calls.list++;
        const filtered = rows.filter((row) => matches(row, where));
        const start = cursor
          ? filtered.findIndex((row) => row.id === cursor.id) + 1
          : 0;
        return Promise.resolve(filtered.slice(start, start + take));
      },
      groupBy: ({ where }: { where: Row }) => {
        calls.group++;
        const counts = new Map<string, number>();
        for (const row of rows.filter((row) => matches(row, where))) {
          counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        }
        return Promise.resolve(
          [...counts].map(([status, id]) => ({ status, _count: { id } })),
        );
      },
      count: ({ where }: { where: Row }) => {
        calls.count++;
        return Promise.resolve(
          rows.filter((row) => matches(row, where)).length,
        );
      },
    },
  };
  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    {} as QuestionSyncDispatcher,
    {} as QuestionAnswerDispatcher,
    {} as QuestionDraftService,
    {} as ProductKnowledgeService,
  );
  return { service, calls };
}

void test('pending badge and total intersect selected states with search across pages', async () => {
  const { service } = fixture();
  const query = Object.assign(new QuestionListQueryDto(), {
    query: 'kargo',
    pendingStates: [State.REVIEW_REQUIRED],
    limit: 1,
  });
  const first = await service.findAll('store-a', 'user-a', query);
  assert.ok('summary' in first);
  assert.deepEqual(
    first.items.map((row) => row.id),
    ['review-a'],
  );
  assert.equal(first.summary?.pending, 2);
  assert.equal(first.total, 2);
  assert.equal(first.summary?.answered, 1);
  assert.equal(first.summary?.ignored, 1);
  const next = await service.findAll(
    'store-a',
    'user-a',
    Object.assign(query, { cursor: first.nextCursor }),
  );
  assert.ok('summary' in next);
  assert.deepEqual(
    next.items.map((row) => row.id),
    ['review-b'],
  );
  assert.equal(next.nextCursor, null);
  assert.equal(next.summary?.pending, 2);
});

void test('all and no pending states retain overall totals and other tab counts', async () => {
  const { service, calls } = fixture();
  const all = await service.findAll(
    'store-a',
    'user-a',
    new QuestionListQueryDto(),
  );
  assert.ok('summary' in all);
  assert.equal(all.items.length, 7);
  assert.deepEqual(all.summary, {
    total: 9,
    pending: 7,
    answered: 1,
    ignored: 1,
  });
  const none = await service.findAll(
    'store-a',
    'user-a',
    Object.assign(new QuestionListQueryDto(), { pendingStates: [] }),
  );
  assert.ok('summary' in none);
  assert.deepEqual(none.items, []);
  assert.equal(none.total, 0);
  assert.deepEqual(none.summary, {
    total: 9,
    pending: 0,
    answered: 1,
    ignored: 1,
  });
  assert.equal(calls.count, 0);
  assert.equal(ALL_PENDING_QUESTION_STATES.length, 12);
});

void test('multiple selected states count each question once, also on answered tab', async () => {
  const { service } = fixture();
  const result = await service.findAll(
    'store-a',
    'user-a',
    Object.assign(new QuestionListQueryDto(), {
      status: Status.ANSWERED,
      pendingStates: [
        State.REVIEW_REQUIRED,
        State.READY_TO_SEND,
        State.SEND_FAILED,
      ],
    }),
  );
  assert.ok('summary' in result);
  assert.deepEqual(
    result.items.map((row) => row.id),
    ['answered'],
  );
  assert.equal(result.total, 1);
  assert.equal(result.summary?.pending, 4);
});

void test('lightweight pages use the same search/state filter without count queries', async () => {
  const { service, calls } = fixture();
  const result = await service.findAll(
    'store-a',
    'user-a',
    Object.assign(new QuestionListQueryDto(), {
      query: 'beden',
      pendingStates: [State.REVIEW_REQUIRED],
      includeSummary: false,
    }),
  );
  assert.deepEqual(
    result.items.map((row) => row.id),
    ['review-size'],
  );
  assert.equal('summary' in result, false);
  assert.deepEqual(calls, { list: 1, group: 0, count: 0 });
});

void test('unauthorized users cannot request lists or filtered counts', async () => {
  const { service, calls } = fixture(false);
  await assert.rejects(
    service.findAll('store-a', 'user-a', new QuestionListQueryDto()),
  );
  assert.deepEqual(calls, { list: 0, group: 0, count: 0 });
});
