import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ProductAnswerFact } from '../questions/product-answer-context.types';
import {
  AiPerformanceQueryDto,
  AiPerformanceRange,
} from './dto/ai-performance-query.dto';

type DraftMetrics = {
  total: number;
  questions: number;
  confidence: number;
  ready: number;
  review: number;
  blocked: number;
  shadow: number;
  shadowEligible: number;
  evaluated: number;
  eligible: number;
};

type DeliveryMetrics = {
  total: number;
  assisted: number;
  unchanged: number;
  edited: number;
  automatic: number;
  manual: number;
  failed: number;
  queued: number;
  processing: number;
};

type ProviderMetrics = {
  providerKey: string;
  totalDrafts: number;
  averageConfidence: number;
  readyDrafts: number;
  needsReviewDrafts: number;
  sentAnswers: number;
  acceptedUnchanged: number;
  editedAnswers: number;
  autoSentAnswers: number;
};

type IntentMetrics = {
  intent: ProductAnswerFact;
  totalDrafts: number;
  averageConfidence: number;
  readyDrafts: number;
  needsReviewDrafts: number;
  eligibleDrafts: number;
  sentAnswers: number;
  reviewedAnswers: number;
  editedAnswers: number;
};

const PRODUCT_ANSWER_FACTS: ProductAnswerFact[] = [
  'STOCK',
  'PRICE',
  'MATERIAL',
  'DURABILITY',
  'SHIPPING',
  'RETURN',
  'EXCHANGE',
  'WARRANTY',
  'SIZE',
  'COLOR',
  'FIT',
  'CARE',
  'PRODUCT_CODE',
  'PRODUCT_INFO',
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAiPerformance(
    storeId: string,
    userId: string,
    query: AiPerformanceQueryDto,
  ) {
    // One read snapshot keeps totals, chart and activity consistent while
    // background workers finish drafts and send answers.
    return this.prisma.$transaction(
      async (db) => {
        const membership = await db.storeMember.findFirst({
          where: { storeId, userId, store: { status: 'ACTIVE' } },
          select: {
            store: {
              select: {
                timezone: true,
                knowledgeProfile: { select: { automationMode: true } },
              },
            },
          },
        });
        if (!membership) {
          throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
        }

        const now = new Date();
        const timezone = validTimezone(membership.store.timezone);
        const range = query.range ?? AiPerformanceRange.THIRTY_DAYS;
        const provider = query.provider?.trim() || null;
        const days =
          range === AiPerformanceRange.SEVEN_DAYS
            ? 7
            : range === AiPerformanceRange.NINETY_DAYS
              ? 90
              : 30;
        const monthly = range === AiPerformanceRange.ALL;
        const [bounds] = await db.$queryRaw<Array<{ from: Date }>>(Prisma.sql`
        SELECT ((((${now}::timestamptz AT TIME ZONE ${timezone})::date
          - (${days}::int - 1))::timestamp AT TIME ZONE ${timezone})
          AT TIME ZONE 'UTC') AS "from"
      `);
        const from = monthly ? null : bounds.from;
        const providerFilter = provider
          ? Prisma.sql`AND c.provider = ${provider}`
          : Prisma.empty;
        const attemptTime = from
          ? Prisma.sql`AND a."createdAt" >= ${from}`
          : Prisma.empty;
        const sentTime = from
          ? Prisma.sql`AND d."sentAt" >= ${from}`
          : Prisma.empty;
        const queuedTime = from
          ? Prisma.sql`AND d."queuedAt" >= ${from}`
          : Prisma.empty;

        // Only aggregate rows cross the database boundary. ALL never hydrates
        // the complete history into application memory.
        const source = Prisma.sql`
        WITH attempts AS (
          SELECT a.id, a."questionId", a.decision, a.confidence,
            a."requestedFacts", a."automationMode", a."autoSendEligible",
            a."eligibilityReasons", a.risks, a."missingInformation", a."createdAt",
            c.provider AS "providerKey"
          FROM ai_draft_attempt a
          JOIN product_question q ON q.id = a."questionId" AND q."storeId" = ${storeId}
          JOIN channel_connection c ON c.id = q."connectionId" AND c."storeId" = ${storeId}
          WHERE a."storeId" = ${storeId} AND a."createdAt" <= ${now} ${attemptTime} ${providerFilter}
        ), deliveries AS (
          SELECT d.id, d."draftAttemptId", d.origin, d.composition, d.status,
            d."sentAt", c.provider AS "providerKey"
          FROM question_answer d
          JOIN channel_connection c ON c.id = d."connectionId" AND c."storeId" = ${storeId}
          WHERE d."storeId" = ${storeId} ${providerFilter} AND (
            (d.status = 'SENT' AND d."sentAt" <= ${now} ${sentTime})
            OR (d.status IN ('FAILED', 'QUEUED', 'PROCESSING') AND d."queuedAt" <= ${now} ${queuedTime})
          )
        )
      `;
        const facts = Prisma.sql`ARRAY[${Prisma.join(PRODUCT_ANSWER_FACTS)}]::text[]`;
        // Interactive transactions use one connection; issue each query in
        // order instead of queueing parallel work on that same connection.
        const draftRows = await db.$queryRaw<
          DraftMetrics[]
        >(Prisma.sql`${source}
          SELECT COUNT(*)::int AS total, COUNT(DISTINCT "questionId")::int AS questions,
            COALESCE(AVG(confidence), 0)::float8 AS confidence,
            COUNT(*) FILTER (WHERE decision = 'READY_FOR_SEND')::int AS ready,
            COUNT(*) FILTER (WHERE decision = 'NEEDS_REVIEW')::int AS review,
            COUNT(*) FILTER (WHERE decision = 'DO_NOT_REPLY')::int AS blocked,
            COUNT(*) FILTER (WHERE "automationMode" = 'SHADOW')::int AS shadow,
            COUNT(*) FILTER (WHERE "automationMode" = 'SHADOW' AND "autoSendEligible")::int AS "shadowEligible",
            COUNT(*) FILTER (WHERE "automationMode" IN ('SHADOW', 'SAFE_AUTO'))::int AS evaluated,
            COUNT(*) FILTER (WHERE "automationMode" IN ('SHADOW', 'SAFE_AUTO') AND "autoSendEligible")::int AS eligible
          FROM attempts
        `);
        const deliveryRows = await db.$queryRaw<
          DeliveryMetrics[]
        >(Prisma.sql`${source}
          SELECT COUNT(*) FILTER (WHERE status = 'SENT')::int AS total,
            COUNT(*) FILTER (WHERE status = 'SENT' AND "draftAttemptId" IS NOT NULL)::int AS assisted,
            COUNT(*) FILTER (WHERE status = 'SENT' AND "draftAttemptId" IS NOT NULL AND origin = 'MANUAL' AND composition = 'AI_UNCHANGED')::int AS unchanged,
            COUNT(*) FILTER (WHERE status = 'SENT' AND "draftAttemptId" IS NOT NULL AND origin = 'MANUAL' AND composition = 'AI_EDITED')::int AS edited,
            COUNT(*) FILTER (WHERE status = 'SENT' AND "draftAttemptId" IS NOT NULL AND origin = 'AUTOMATION')::int AS automatic,
            COUNT(*) FILTER (WHERE status = 'SENT' AND "draftAttemptId" IS NULL)::int AS manual,
            COUNT(*) FILTER (WHERE status = 'FAILED' AND "draftAttemptId" IS NOT NULL)::int AS failed,
            COUNT(*) FILTER (WHERE status = 'QUEUED' AND "draftAttemptId" IS NOT NULL)::int AS queued,
            COUNT(*) FILTER (WHERE status = 'PROCESSING' AND "draftAttemptId" IS NOT NULL)::int AS processing
          FROM deliveries
        `);
        const providers = await db.$queryRaw<
          ProviderMetrics[]
        >(Prisma.sql`${source},
          drafts AS (
            SELECT "providerKey", COUNT(*)::int AS total,
              AVG(confidence)::float8 AS confidence,
              COUNT(*) FILTER (WHERE decision = 'READY_FOR_SEND')::int AS ready,
              COUNT(*) FILTER (WHERE decision = 'NEEDS_REVIEW')::int AS review
            FROM attempts GROUP BY "providerKey"
          ), sent AS (
            SELECT "providerKey", COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE "draftAttemptId" IS NOT NULL AND origin = 'MANUAL' AND composition = 'AI_UNCHANGED')::int AS unchanged,
              COUNT(*) FILTER (WHERE "draftAttemptId" IS NOT NULL AND origin = 'MANUAL' AND composition = 'AI_EDITED')::int AS edited,
              COUNT(*) FILTER (WHERE "draftAttemptId" IS NOT NULL AND origin = 'AUTOMATION')::int AS automatic
            FROM deliveries WHERE status = 'SENT' GROUP BY "providerKey"
          )
          SELECT COALESCE(a."providerKey", d."providerKey") AS "providerKey",
            COALESCE(a.total, 0) AS "totalDrafts", COALESCE(a.confidence, 0) AS "averageConfidence",
            COALESCE(a.ready, 0) AS "readyDrafts", COALESCE(a.review, 0) AS "needsReviewDrafts",
            COALESCE(d.total, 0) AS "sentAnswers", COALESCE(d.unchanged, 0) AS "acceptedUnchanged",
            COALESCE(d.edited, 0) AS "editedAnswers", COALESCE(d.automatic, 0) AS "autoSentAnswers"
          FROM drafts a FULL OUTER JOIN sent d ON a."providerKey" = d."providerKey"
          ORDER BY "totalDrafts" DESC, "providerKey"
        `);
        const intents = await db.$queryRaw<
          IntentMetrics[]
        >(Prisma.sql`${source},
          draft_facts AS (
            SELECT a.*, f.intent FROM attempts a
            CROSS JOIN LATERAL (
              SELECT DISTINCT value AS intent FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(a."requestedFacts") = 'array' THEN a."requestedFacts" ELSE '[]'::jsonb END
              ) WHERE value = ANY(${facts})
              UNION ALL SELECT 'PRODUCT_INFO' WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(a."requestedFacts") = 'array' THEN a."requestedFacts" ELSE '[]'::jsonb END
                ) WHERE value = ANY(${facts})
              )
            ) f
          ), sent_facts AS (
            SELECT d.*, f.intent FROM deliveries d
            JOIN ai_draft_attempt a ON a.id = d."draftAttemptId" AND a."storeId" = ${storeId}
            CROSS JOIN LATERAL (
              SELECT DISTINCT value AS intent FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(a."requestedFacts") = 'array' THEN a."requestedFacts" ELSE '[]'::jsonb END
              ) WHERE value = ANY(${facts})
              UNION ALL SELECT 'PRODUCT_INFO' WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(a."requestedFacts") = 'array' THEN a."requestedFacts" ELSE '[]'::jsonb END
                ) WHERE value = ANY(${facts})
              )
            ) f WHERE d.status = 'SENT'
          ), drafts AS (
            SELECT intent, COUNT(*)::int AS total, AVG(confidence)::float8 AS confidence,
              COUNT(*) FILTER (WHERE decision = 'READY_FOR_SEND')::int AS ready,
              COUNT(*) FILTER (WHERE decision = 'NEEDS_REVIEW')::int AS review,
              COUNT(*) FILTER (WHERE "autoSendEligible")::int AS eligible
            FROM draft_facts GROUP BY intent
          ), sent AS (
            SELECT intent, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE origin = 'MANUAL' AND composition IN ('AI_UNCHANGED', 'AI_EDITED'))::int AS reviewed,
              COUNT(*) FILTER (WHERE origin = 'MANUAL' AND composition = 'AI_EDITED')::int AS edited
            FROM sent_facts GROUP BY intent
          )
          SELECT COALESCE(a.intent, d.intent) AS intent,
            COALESCE(a.total, 0) AS "totalDrafts", COALESCE(a.confidence, 0) AS "averageConfidence",
            COALESCE(a.ready, 0) AS "readyDrafts", COALESCE(a.review, 0) AS "needsReviewDrafts",
            COALESCE(a.eligible, 0) AS "eligibleDrafts", COALESCE(d.total, 0) AS "sentAnswers",
            COALESCE(d.reviewed, 0) AS "reviewedAnswers", COALESCE(d.edited, 0) AS "editedAnswers"
          FROM drafts a FULL OUTER JOIN sent d ON a.intent = d.intent
          ORDER BY "totalDrafts" DESC, intent
        `);
        const reasons = await db.$queryRaw<
          Array<{ key: string; count: number }>
        >(Prisma.sql`${source},
          review AS (
            SELECT a.id,
              ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(a."eligibilityReasons") = 'array' THEN a."eligibilityReasons" ELSE '[]'::jsonb END
              ) WHERE value <> '' AND value <> 'REVIEW_REQUIRED') AS reasons,
              ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(a.risks) = 'array' THEN a.risks ELSE '[]'::jsonb END
              ) WHERE value <> '') AS risks,
              CASE WHEN jsonb_typeof(a."missingInformation") = 'array'
                THEN jsonb_array_length(a."missingInformation") > 0 ELSE false END AS missing
            FROM attempts a WHERE decision = 'NEEDS_REVIEW'
          ), reason_rows AS (
            SELECT id, unnest(CASE
              WHEN cardinality(reasons) > 0 THEN reasons
              WHEN cardinality(risks) > 0 THEN risks
              WHEN missing THEN ARRAY['MISSING_INFORMATION']
              ELSE ARRAY['REVIEW_REQUIRED'] END) AS key FROM review
          )
          SELECT key, COUNT(DISTINCT id)::int AS count FROM reason_rows
          GROUP BY key ORDER BY count DESC, key
        `);
        const trend = await db.$queryRaw<
          Array<{ date: string; drafts: number; sent: number }>
        >(Prisma.sql`${source},
          events AS (
            SELECT date_trunc(${monthly ? 'month' : 'day'}, "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) AS bucket,
              1 AS drafts, 0 AS sent FROM attempts
            UNION ALL
            SELECT date_trunc(${monthly ? 'month' : 'day'}, "sentAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
              0, 1 FROM deliveries WHERE status = 'SENT' AND "draftAttemptId" IS NOT NULL
          ), buckets AS (
            SELECT generate_series(
              ${
                monthly
                  ? Prisma.sql`COALESCE((SELECT MIN(bucket) FROM events), date_trunc('month', ${now}::timestamptz AT TIME ZONE ${timezone}))`
                  : Prisma.sql`(${from}::timestamptz AT TIME ZONE ${timezone})::date`
              },
              date_trunc(${monthly ? 'month' : 'day'}, ${now}::timestamptz AT TIME ZONE ${timezone}),
              ${monthly ? '1 month' : '1 day'}::interval
            ) AS bucket
          )
          SELECT to_char(b.bucket, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(e.drafts), 0)::int AS drafts,
            COALESCE(SUM(e.sent), 0)::int AS sent
          FROM buckets b LEFT JOIN events e ON e.bucket = b.bucket
          GROUP BY b.bucket ORDER BY b.bucket
        `);
        const recent = await db.aiDraftAttempt.findMany({
          where: {
            storeId,
            createdAt: { ...(from ? { gte: from } : {}), lte: now },
            ...(provider
              ? { question: { connection: { providerKey: provider } } }
              : {}),
          },
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            trigger: true,
            outcome: true,
            decision: true,
            confidence: true,
            requestedFacts: true,
            automationMode: true,
            autoSendEligible: true,
            appliedConfidenceThreshold: true,
            eligibilityReasons: true,
            createdAt: true,
            question: {
              select: {
                id: true,
                question: true,
                customerName: true,
                product: { select: { title: true } },
                connection: { select: { providerKey: true } },
              },
            },
            answerDelivery: {
              select: {
                origin: true,
                composition: true,
                status: true,
                sentAt: true,
              },
            },
          },
        });
        const connections = await db.channelConnection.findMany({
          where: { storeId },
          select: { providerKey: true },
          orderBy: { providerKey: 'asc' },
        });
        const draft = draftRows[0];
        const sent = deliveryRows[0];
        const reviewed = sent.unchanged + sent.edited;

        return {
          range,
          provider,
          timezone,
          availableProviders: connections.map(
            (connection) => connection.providerKey,
          ),
          from: from?.toISOString() ?? null,
          generatedAt: now.toISOString(),
          summary: {
            totalDrafts: draft.total,
            uniqueQuestions: draft.questions,
            reviewedAnswers: reviewed,
            averageConfidence: confidence(draft.confidence),
            readyRate: percentage(draft.ready, draft.total),
            needsReviewRate: percentage(draft.review, draft.total),
            acceptanceRate: percentage(sent.unchanged, reviewed),
            editRate: percentage(sent.edited, reviewed),
            aiCoverageRate: percentage(sent.assisted, sent.total),
            deliverySuccessRate: percentage(
              sent.assisted,
              sent.assisted + sent.failed,
            ),
            shadowEligibilityRate: percentage(
              draft.shadowEligible,
              draft.shadow,
            ),
          },
          answers: {
            totalSent: sent.total,
            aiAssisted: sent.assisted,
            acceptedUnchanged: sent.unchanged,
            edited: sent.edited,
            autoSent: sent.automatic,
            manualOnly: sent.manual,
          },
          delivery: {
            failed: sent.failed,
            queued: sent.queued,
            processing: sent.processing,
            successRate:
              sent.assisted + sent.failed > 0
                ? percentage(sent.assisted, sent.assisted + sent.failed)
                : null,
          },
          draftDecisions: {
            ready: draft.ready,
            needsReview: draft.review,
            blocked: draft.blocked,
          },
          shadow: {
            evaluated: draft.shadow,
            wouldAutoSend: draft.shadowEligible,
            keptForReview: draft.shadow - draft.shadowEligible,
          },
          automation: {
            mode: membership.store.knowledgeProfile?.automationMode ?? 'OFF',
            evaluated: draft.evaluated,
            eligible: draft.eligible,
            withheld: draft.evaluated - draft.eligible,
          },
          trend,
          trendGranularity: monthly ? ('month' as const) : ('day' as const),
          reviewReasons: reasons,
          providers: providers.map((metric) => ({
            providerKey: metric.providerKey,
            totalDrafts: metric.totalDrafts,
            averageConfidence: confidence(metric.averageConfidence),
            readyRate: percentage(metric.readyDrafts, metric.totalDrafts),
            needsReviewRate: percentage(
              metric.needsReviewDrafts,
              metric.totalDrafts,
            ),
            sentAnswers: metric.sentAnswers,
            acceptedUnchanged: metric.acceptedUnchanged,
            editedAnswers: metric.editedAnswers,
            autoSentAnswers: metric.autoSentAnswers,
          })),
          intents: intents.map((metric) => ({
            intent: metric.intent,
            totalDrafts: metric.totalDrafts,
            averageConfidence: confidence(metric.averageConfidence),
            readyRate: percentage(metric.readyDrafts, metric.totalDrafts),
            needsReviewRate: percentage(
              metric.needsReviewDrafts,
              metric.totalDrafts,
            ),
            autoSendEligibilityRate: percentage(
              metric.eligibleDrafts,
              metric.totalDrafts,
            ),
            sentAnswers: metric.sentAnswers,
            reviewedAnswers: metric.reviewedAnswers,
            editRate: percentage(metric.editedAnswers, metric.reviewedAnswers),
          })),
          recentActivity: recent.map((attempt) => ({
            id: attempt.id,
            questionId: attempt.question.id,
            question: attempt.question.question,
            customerName: attempt.question.customerName,
            productTitle: attempt.question.product?.title ?? null,
            providerKey: attempt.question.connection.providerKey,
            trigger: attempt.trigger,
            outcome: attempt.outcome,
            decision: attempt.decision,
            confidence: confidence(attempt.confidence),
            requestedFacts: toRequestedFacts(attempt.requestedFacts),
            automationMode: attempt.automationMode,
            autoSendEligible: attempt.autoSendEligible,
            appliedConfidenceThreshold: confidence(
              attempt.appliedConfidenceThreshold,
            ),
            eligibilityReasons: stringArray(attempt.eligibilityReasons),
            composition: attempt.answerDelivery?.composition ?? null,
            deliveryStatus: attempt.answerDelivery?.status ?? null,
            deliveryOrigin: attempt.answerDelivery?.origin ?? null,
            createdAt: attempt.createdAt.toISOString(),
            sentAt: attempt.answerDelivery?.sentAt?.toISOString() ?? null,
          })),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
}

function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return 'Europe/Istanbul';
  }
}

function stringArray(value: Prisma.JsonValue | null) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === 'string' && item.length > 0,
          ),
        ),
      ]
    : [];
}

function toRequestedFacts(value: Prisma.JsonValue | null) {
  return stringArray(value).filter((item): item is ProductAnswerFact =>
    PRODUCT_ANSWER_FACTS.includes(item as ProductAnswerFact),
  );
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 1000) / 10;
}

function confidence(value: number) {
  return Math.round(value * 10000) / 10000;
}
