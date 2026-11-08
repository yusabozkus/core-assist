import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaService } from '../../database/prisma.service';
import { AnalyticsService } from './analytics.service';
import { AiPerformanceRange } from './dto/ai-performance-query.dto';
import { Prisma } from '../../generated/prisma/client';
import { validate } from 'class-validator';
import {
  AiPerformanceDetailKind,
  AiPerformanceDetailQueryDto,
} from './dto/ai-performance-detail-query.dto';

type RecordValue = Record<string, unknown>;

// Evaluate the actual count filter against records; no database connection or
// development data is involved. SQL aggregate results are independent fixtures.
function matches(record: RecordValue, where: RecordValue): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') {
      return (condition as RecordValue[]).some((item) => matches(record, item));
    }
    if (condition && typeof condition === 'object' && 'is' in condition) {
      const relation = record[key];
      return condition.is === null
        ? relation === null
        : !!relation &&
            matches(relation as RecordValue, condition.is as RecordValue);
    }
    return record[key] === condition;
  });
}

function fixture({
  authorized = true,
  confidenceSamples = 35,
  confidence = 0.8,
  previous = {
    drafts: 100,
    review: 20,
    assisted: 40,
    unchanged: 15,
    edited: 5,
    automatic: 20,
  },
} = {}) {
  const reviewQuestion = {
    storeId: 'store-a',
    status: 'DRAFTED',
    draftDecision: 'NEEDS_REVIEW',
    draftProcessingStatus: null,
    answerDelivery: null,
    provider: 'hepsiburada',
    createdAt: new Date('2020-01-01T00:00:00Z'),
  };
  const questions = [
    reviewQuestion,
    { ...reviewQuestion, answerDelivery: { status: 'FAILED' } },
    { ...reviewQuestion, storeId: 'store-b' },
    { ...reviewQuestion, status: 'ANSWERED' },
    { ...reviewQuestion, status: 'IGNORED' },
    { ...reviewQuestion, draftDecision: 'READY_FOR_SEND' },
    { ...reviewQuestion, draftProcessingStatus: 'PROCESSING' },
    { ...reviewQuestion, draftProcessingStatus: 'QUEUED' },
    { ...reviewQuestion, answerDelivery: { status: 'SENT' } },
    { ...reviewQuestion, answerDelivery: { status: 'QUEUED' } },
    { ...reviewQuestion, answerDelivery: { status: 'PROCESSING' } },
  ];
  const aggregates = [
    [
      {
        from: new Date('2026-10-01T00:00:00Z'),
        previousFrom: new Date('2026-09-24T00:00:00Z'),
        previousTo: new Date('2026-09-26T12:00:00Z'),
      },
    ],
    [
      {
        total: 35,
        questions: 10,
        confidence,
        confidenceSamples,
        ready: 0,
        review: 35,
        blocked: 0,
        shadow: 0,
        shadowEligible: 0,
        evaluated: 35,
        eligible: 0,
      },
    ],
    [
      {
        total: 0,
        assisted: 0,
        unchanged: 0,
        edited: 0,
        automatic: 0,
        manual: 0,
        failed: 0,
        queued: 0,
        processing: 0,
      },
    ],
    [],
    [],
    [{ key: 'MISSING_INFORMATION', count: 35 }],
    [],
    [previous],
  ];
  let countCalls = 0;
  const queries: Prisma.Sql[] = [];
  const db = {
    storeMember: {
      findFirst: () =>
        Promise.resolve(
          authorized
            ? { store: { timezone: 'Europe/Istanbul', knowledgeProfile: null } }
            : null,
        ),
    },
    $queryRaw: (query: Prisma.Sql) => {
      queries.push(query);
      return Promise.resolve(aggregates.shift());
    },
    aiDraftAttempt: { findMany: () => Promise.resolve([]) },
    channelConnection: { findMany: () => Promise.resolve([]) },
    productQuestion: {
      count: ({ where }: { where: RecordValue }) => {
        countCalls++;
        return Promise.resolve(
          questions.filter((question) => matches(question, where)).length,
        );
      },
    },
  };
  const prisma = {
    $transaction: (read: (database: typeof db) => unknown) =>
      Promise.resolve(read(db)),
  } as unknown as PrismaService;
  return {
    service: new AnalyticsService(prisma),
    countCalls: () => countCalls,
    questions,
    queries,
  };
}

void test('current review counts open questions once, independently of historical drafts, date and marketplace', async () => {
  for (const range of [AiPerformanceRange.SEVEN_DAYS, AiPerformanceRange.ALL]) {
    const { service } = fixture();
    const data = await service.findAiPerformance('store-a', 'user-a', {
      range,
      provider: 'trendyol',
    });
    assert.equal(data.draftDecisions.needsReview, 35);
    assert.equal(data.currentWorkload.needsReview, 2);
  }
});

void test('completed review history does not create a current backlog', async () => {
  const { service, questions } = fixture();
  questions.forEach((question) => {
    question.status = 'ANSWERED';
  });
  const data = await service.findAiPerformance('store-a', 'user-a', {
    range: AiPerformanceRange.THIRTY_DAYS,
  });
  assert.equal(data.draftDecisions.needsReview, 35);
  assert.equal(data.currentWorkload.needsReview, 0);
});

void test('a user without store membership cannot access the current review count', async () => {
  const { service, countCalls, queries } = fixture({ authorized: false });
  await assert.rejects(
    service.findAiPerformance('store-a', 'user-b', {
      range: AiPerformanceRange.ALL,
    }),
    /Mağaza bulunamadı veya erişiminiz yok/,
  );
  assert.equal(countCalls(), 0);
  assert.equal(queries.length, 0);
});

void test('previous period compares the same store and marketplace using timezone bounds and the same answer denominators', async () => {
  const { service, queries } = fixture();
  const data = await service.findAiPerformance('store-a', 'user-a', {
    range: AiPerformanceRange.SEVEN_DAYS,
    provider: 'trendyol',
  });
  assert.deepEqual(data.comparison, {
    from: '2026-09-24T00:00:00.000Z',
    to: '2026-09-26T12:00:00.000Z',
    totalDrafts: 100,
    aiAssisted: 40,
    autoSent: 20,
    acceptanceRate: 75,
    needsReviewRate: 20,
  });
  const previous = queries.at(-1)!;
  assert.ok(previous.values.includes('store-a'));
  assert.ok(previous.values.includes('trendyol'));
  assert.ok(
    previous.values.some(
      (value) =>
        value instanceof Date && value.toISOString() === data.comparison?.from,
    ),
  );
  assert.ok(
    previous.values.some(
      (value) =>
        value instanceof Date && value.toISOString() === data.comparison?.to,
    ),
  );
  assert.match(previous.text, /FROM deliveries WHERE status = 'SENT'/);
  assert.ok(queries[0].values.includes('Europe/Istanbul'));
  assert.ok(queries[0].values.includes(7));
  assert.match(
    queries[0].text,
    /local_now - make_interval\(days => span_days\)/,
  );
});

void test('an empty previous period has zero volumes and unavailable rates rather than false zero-percent quality', async () => {
  const { service } = fixture({
    previous: {
      drafts: 0,
      review: 0,
      assisted: 0,
      unchanged: 0,
      edited: 0,
      automatic: 0,
    },
  });
  const data = await service.findAiPerformance('store-a', 'user-a', {
    range: AiPerformanceRange.THIRTY_DAYS,
  });
  assert.equal(data.comparison?.totalDrafts, 0);
  assert.equal(data.comparison?.acceptanceRate, null);
  assert.equal(data.comparison?.needsReviewRate, null);
});

void test('all-time view does not query or expose an artificial previous period', async () => {
  const { service, queries } = fixture();
  const data = await service.findAiPerformance('store-a', 'user-a', {
    range: AiPerformanceRange.ALL,
  });
  assert.equal(data.comparison, null);
  assert.equal(queries.length, 7);
});

void test('confidence retains its eligible sample count so absent scores and genuine zero scores stay distinguishable', async () => {
  for (const samples of [0, 1]) {
    const { service, queries } = fixture({
      confidence: 0,
      confidenceSamples: samples,
    });
    const data = await service.findAiPerformance('store-a', 'user-a', {
      range: AiPerformanceRange.ALL,
    });
    assert.equal(data.summary.totalDrafts, 35);
    assert.equal(data.summary.averageConfidence, 0);
    assert.equal(data.summary.confidenceSamples, samples);
    assert.match(
      queries[1].text,
      /COUNT\(\*\) FILTER \(WHERE answerability <> 'OUT_OF_SCOPE'\)::int AS "confidenceSamples"/,
    );
    assert.match(queries[3].text, /COALESCE\(a\."confidenceSamples", 0\)/);
  }
});

function detailFixture({ authorized = true, rows = [] as RecordValue[] } = {}) {
  const queries: Prisma.Sql[] = [];
  let membershipWhere: unknown;
  const db = {
    storeMember: {
      findFirst: ({ where }: { where: unknown }) => {
        membershipWhere = where;
        return Promise.resolve(
          authorized ? { store: { timezone: 'Europe/Istanbul' } } : null,
        );
      },
    },
    $queryRaw: (query: Prisma.Sql) => {
      queries.push(query);
      return Promise.resolve(
        queries.length === 1
          ? [{ from: new Date('2025-05-01T21:00:00Z') }]
          : rows,
      );
    },
  };
  const prisma = {
    $transaction: (read: (database: typeof db) => unknown) =>
      Promise.resolve(read(db)),
  } as unknown as PrismaService;
  return {
    service: new AnalyticsService(prisma),
    queries,
    membershipWhere: () => membershipWhere,
  };
}

void test('review drilldown preserves the selected snapshot and marketplace while showing current question state and paging distinct questions', async () => {
  const first = {
    questionId: '00000000-0000-4000-8000-000000000002',
    question: 'Hangi kargo?',
    customerName: null,
    productTitle: 'Pantolon',
    providerKey: 'trendyol',
    status: 'ANSWERED',
    draftDecision: 'READY_FOR_SEND',
    draftProcessingStatus: null,
    deliveryStatus: 'SENT',
    eventCount: 3,
    lastMatchedAt: new Date('2025-05-05T10:00:00Z'),
    totalQuestions: 2,
    totalEvents: 4,
  };
  const { service, queries, membershipWhere } = detailFixture({
    rows: [
      first,
      {
        ...first,
        questionId: '00000000-0000-4000-8000-000000000001',
        eventCount: 1,
      },
    ],
  });
  const asOf = '2025-05-06T00:00:00Z';
  const query = Object.assign(new AiPerformanceDetailQueryDto(), {
    kind: AiPerformanceDetailKind.REVIEW_REASON,
    reason: 'MISSING_INFORMATION',
    range: AiPerformanceRange.SEVEN_DAYS,
    provider: 'trendyol',
    asOf,
    limit: 1,
  });
  const page = await service.findAiPerformanceQuestions(
    'store-a',
    'user-a',
    query,
  );
  assert.deepEqual(membershipWhere(), {
    storeId: 'store-a',
    userId: 'user-a',
    store: { status: 'ACTIVE' },
  });
  assert.deepEqual(page.totals, { questions: 2, events: 4 });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].status, 'ANSWERED');
  assert.equal(page.items[0].eventCount, 3);
  assert.equal('totalQuestions' in page.items[0], false);
  assert.deepEqual(page.nextCursor, {
    questionId: first.questionId,
    before: first.lastMatchedAt.toISOString(),
  });
  const sql = queries[1];
  assert.ok(sql.values.includes('trendyol'));
  assert.ok(sql.values.includes('MISSING_INFORMATION'));
  assert.ok(
    sql.values.some(
      (value) =>
        value instanceof Date &&
        value.toISOString() === new Date(asOf).toISOString(),
    ),
  );
  assert.doesNotMatch(sql.text, /trendyol/);
  assert.match(sql.text, /WHERE r.key = \$\d+/);
  assert.match(sql.text, /GROUP BY "questionId"/);
  assert.match(sql.text, /cardinality\(reasons\) > 0/);
  assert.match(sql.text, /cardinality\(risks\) > 0/);
});

void test('failed delivery drilldown uses AI failures only and stable time/id pagination', async () => {
  const { service, queries } = detailFixture();
  const cursor = '00000000-0000-4000-8000-000000000002';
  const before = '2025-05-05T10:00:00Z';
  const page = await service.findAiPerformanceQuestions(
    'store-a',
    'user-a',
    Object.assign(new AiPerformanceDetailQueryDto(), {
      kind: AiPerformanceDetailKind.FAILED_DELIVERY,
      range: AiPerformanceRange.ALL,
      asOf: '2025-05-06T00:00:00Z',
      cursor,
      before,
    }),
  );
  assert.deepEqual(page, {
    totals: { questions: 0, events: 0 },
    items: [],
    nextCursor: null,
  });
  assert.match(
    queries[1].text,
    /d.status = 'FAILED' AND d."draftAttemptId" IS NOT NULL/,
  );
  assert.match(queries[1].text, /\(g."lastMatchedAt", g."questionId"\) </);
  assert.ok(queries[1].values.includes(cursor));
  assert.ok(
    queries[1].values.some(
      (value) =>
        value instanceof Date &&
        value.toISOString() === new Date(before).toISOString(),
    ),
  );
});

void test('detail authorization denies another user before any analytics query', async () => {
  const { service, queries } = detailFixture({ authorized: false });
  await assert.rejects(
    service.findAiPerformanceQuestions(
      'store-a',
      'user-b',
      Object.assign(new AiPerformanceDetailQueryDto(), {
        kind: AiPerformanceDetailKind.FAILED_DELIVERY,
      }),
    ),
    /Mağaza bulunamadı veya erişiminiz yok/,
  );
  assert.equal(queries.length, 0);
});

void test('detail validation rejects missing reason, excessive page size, invalid dates and incomplete pagination', async () => {
  for (const invalid of [
    { kind: AiPerformanceDetailKind.REVIEW_REASON },
    { kind: AiPerformanceDetailKind.FAILED_DELIVERY, limit: 100 },
    { kind: AiPerformanceDetailKind.FAILED_DELIVERY, before: 'invalid' },
  ]) {
    assert.ok(
      (
        await validate(
          Object.assign(new AiPerformanceDetailQueryDto(), invalid),
        )
      ).length > 0,
    );
  }
  const { service, queries } = detailFixture();
  await assert.rejects(
    service.findAiPerformanceQuestions(
      'store-a',
      'user-a',
      Object.assign(new AiPerformanceDetailQueryDto(), {
        kind: AiPerformanceDetailKind.FAILED_DELIVERY,
        cursor: '00000000-0000-4000-8000-000000000002',
      }),
    ),
    /Sayfalama bilgisi eksik/,
  );
  await assert.rejects(
    service.findAiPerformanceQuestions(
      'store-a',
      'user-a',
      Object.assign(new AiPerformanceDetailQueryDto(), {
        kind: AiPerformanceDetailKind.FAILED_DELIVERY,
        asOf: '2999-01-01T00:00:00Z',
      }),
    ),
    /Geçersiz performans tarihi/,
  );
  assert.equal(queries.length, 0);
});
