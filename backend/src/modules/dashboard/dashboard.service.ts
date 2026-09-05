import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  getInventoryFreshnessCutoff,
  getInventoryFreshnessMaxAgeMs,
} from '../catalog/inventory-freshness';
import { DashboardQueryDto, DashboardRange } from './dto/dashboard-query.dto';

type QueueState =
  'FAILED' | 'PROCESSING' | 'UNMATCHED' | 'REVIEW' | 'READY' | 'PENDING';
type QueueRow = { state: QueueState; count: number };
type ActivityRow = { date: string; incoming: number; answered: number };
type PeriodMetrics = {
  incoming: number;
  previousIncoming: number;
  answered: number;
  previousAnswered: number;
  averageResponseMinutes: number | null;
};
type PriorityQuestion = {
  id: string;
  question: string;
  customerName: string | null;
  productTitle: string | null;
  providerKey: string;
  externalCreatedAt: Date;
  state: QueueState;
};

// A question belongs to exactly one queue bucket. Retries and drafts must not
// inflate the number of waiting questions or overlap with manual review.
const queueState = Prisma.sql`CASE
  WHEN a.status = 'FAILED' OR q."draftProcessingStatus" = 'FAILED' THEN 'FAILED'
  WHEN a.status IN ('QUEUED', 'PROCESSING') OR q."draftProcessingStatus" IN ('QUEUED', 'PROCESSING') THEN 'PROCESSING'
  WHEN q."productId" IS NULL THEN 'UNMATCHED'
  WHEN q."draftDecision" IN ('NEEDS_REVIEW', 'DO_NOT_REPLY') THEN 'REVIEW'
  WHEN q."draftDecision" = 'READY_FOR_SEND' THEN 'READY'
  ELSE 'PENDING' END`;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(storeId: string, userId: string, query: DashboardQueryDto) {
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
        if (!membership) throw new NotFoundException('Mağaza bulunamadı.');

        const now = new Date();
        const timezone = membership.store.timezone;
        const days = query.range === DashboardRange.THIRTY_DAYS ? 30 : 7;
        // Prisma timestamps are UTC without a timezone. Calendar boundaries and
        // chart labels use the store's timezone, including DST transitions.
        const [bounds] = await db.$queryRaw<
          Array<{ from: Date; previousFrom: Date; previousTo: Date }>
        >(Prisma.sql`
        SELECT
          ((((${now}::timestamptz AT TIME ZONE ${timezone})::date - (${days}::int - 1))::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS "from",
          ((((${now}::timestamptz AT TIME ZONE ${timezone})::date - (${days}::int * 2 - 1))::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS "previousFrom",
          ((((${now}::timestamptz AT TIME ZONE ${timezone}) - (${days}::int * interval '1 day')) AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS "previousTo"
      `);
        const { from, previousFrom, previousTo } = bounds;
        const freshnessCutoff = getInventoryFreshnessCutoff(now);
        const waitingFrom = Prisma.sql`
        FROM product_question q
        LEFT JOIN question_answer a ON a."questionId" = q.id AND a."storeId" = ${storeId}
        WHERE q."storeId" = ${storeId} AND q.status IN ('PENDING', 'DRAFTED')
      `;

        const [
          metrics,
          activity,
          queue,
          priorityQuestions,
          channels,
          catalog,
          popular,
        ] = await Promise.all([
          db.$queryRaw<PeriodMetrics[]>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE "externalCreatedAt" >= ${from} AND "externalCreatedAt" <= ${now})::int AS incoming,
            COUNT(*) FILTER (WHERE "externalCreatedAt" >= ${previousFrom} AND "externalCreatedAt" < ${previousTo})::int AS "previousIncoming",
            COUNT(*) FILTER (WHERE status = 'ANSWERED' AND "answeredAt" >= ${from} AND "answeredAt" <= ${now})::int AS answered,
            COUNT(*) FILTER (WHERE status = 'ANSWERED' AND "answeredAt" >= ${previousFrom} AND "answeredAt" < ${previousTo})::int AS "previousAnswered",
            (AVG(EXTRACT(EPOCH FROM ("answeredAt" - "externalCreatedAt")) / 60)
              FILTER (WHERE status = 'ANSWERED' AND "answeredAt" >= ${from} AND "answeredAt" <= ${now} AND "answeredAt" >= "externalCreatedAt"))::float8 AS "averageResponseMinutes"
          FROM product_question
          WHERE "storeId" = ${storeId} AND ("externalCreatedAt" >= ${previousFrom} OR "answeredAt" >= ${previousFrom})
        `),
          db.$queryRaw<ActivityRow[]>(Prisma.sql`
          WITH days AS (
            SELECT generate_series(
              (${from}::timestamptz AT TIME ZONE ${timezone})::date,
              (${now}::timestamptz AT TIME ZONE ${timezone})::date, '1 day'::interval)::date AS day
          ), events AS (
            SELECT ("externalCreatedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date AS day, 1 AS incoming, 0 AS answered
            FROM product_question WHERE "storeId" = ${storeId} AND "externalCreatedAt" >= ${from} AND "externalCreatedAt" <= ${now}
            UNION ALL
            SELECT ("answeredAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date AS day, 0, 1
            FROM product_question WHERE "storeId" = ${storeId} AND status = 'ANSWERED' AND "answeredAt" >= ${from} AND "answeredAt" <= ${now}
          )
          SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(events.incoming), 0)::int AS incoming,
            COALESCE(SUM(events.answered), 0)::int AS answered
          FROM days LEFT JOIN events ON events.day = days.day GROUP BY days.day ORDER BY days.day
        `),
          db.$queryRaw<QueueRow[]>(Prisma.sql`
          SELECT state, COUNT(*)::int AS count FROM (SELECT ${queueState} AS state ${waitingFrom}) waiting GROUP BY state
        `),
          db.$queryRaw<PriorityQuestion[]>(Prisma.sql`
          WITH waiting AS (SELECT q.id, q.question, q."customerName", q."productId", q."connectionId", q."externalCreatedAt", ${queueState} AS state ${waitingFrom})
          SELECT w.id, w.question, w."customerName", w."externalCreatedAt", w.state, p.title AS "productTitle", c.provider AS "providerKey"
          FROM waiting w JOIN channel_connection c ON c.id = w."connectionId" AND c."storeId" = ${storeId}
          LEFT JOIN product p ON p.id = w."productId" AND p."storeId" = ${storeId}
          WHERE w.state <> 'PROCESSING'
          ORDER BY CASE w.state WHEN 'FAILED' THEN 0 WHEN 'UNMATCHED' THEN 1 WHEN 'REVIEW' THEN 2 ELSE 3 END, w."externalCreatedAt", w.id LIMIT 5
        `),
          db.channelConnection.findMany({
            where: { storeId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              providerKey: true,
              status: true,
              lastSyncAt: true,
              lastInventorySyncAt: true,
              lastQuestionSyncAt: true,
              failureReason: true,
              questionSyncFailureReason: true,
              processingStartedAt: true,
              questionSyncStartedAt: true,
              syncRuns: {
                take: 1,
                orderBy: { startedAt: 'desc' },
                select: { id: true, status: true, kind: true, startedAt: true },
              },
            },
          }),
          db.$queryRaw<
            Array<{
              products: number;
              variants: number;
              lowStock: number;
              outOfStock: number;
              stale: number;
            }>
          >(Prisma.sql`
          SELECT (SELECT COUNT(*)::int FROM product WHERE "storeId" = ${storeId} AND status = 'ACTIVE') AS products,
            COUNT(*)::int AS variants,
            COUNT(*) FILTER (WHERE v.status = 'ACTIVE' AND v.stock BETWEEN 1 AND 5)::int AS "lowStock",
            COUNT(*) FILTER (WHERE v.status = 'OUT_OF_STOCK' OR (v.status = 'ACTIVE' AND v.stock <= 0))::int AS "outOfStock",
            COUNT(*) FILTER (WHERE v."lastSyncedAt" IS NULL OR v."lastSyncedAt" < ${freshnessCutoff})::int AS stale
          FROM product_variant v JOIN product p ON p.id = v."productId"
          WHERE p."storeId" = ${storeId} AND p.status = 'ACTIVE' AND v.status <> 'ARCHIVED'
        `),
          db.productQuestion.groupBy({
            by: ['productId'],
            where: {
              storeId,
              productId: { not: null },
              externalCreatedAt: { gte: from, lte: now },
            },
            _count: { id: true },
            orderBy: [{ _count: { id: 'desc' } }, { productId: 'asc' }],
            take: 4,
          }),
        ]);

        const products = await db.product.findMany({
          where: {
            storeId,
            id: {
              in: popular.flatMap((row) =>
                row.productId ? [row.productId] : [],
              ),
            },
          },
          select: {
            id: true,
            title: true,
            brand: true,
            images: {
              take: 1,
              orderBy: { position: 'asc' },
              select: { url: true },
            },
          },
        });
        const counts: Record<QueueState, number> = {
          FAILED: 0,
          PROCESSING: 0,
          UNMATCHED: 0,
          REVIEW: 0,
          READY: 0,
          PENDING: 0,
        };
        for (const row of queue) counts[row.state] = row.count;

        return {
          storeId,
          generatedAt: now.toISOString(),
          period: {
            range: query.range,
            days,
            timezone,
            from: from.toISOString(),
            to: now.toISOString(),
            previousFrom: previousFrom.toISOString(),
            previousTo: previousTo.toISOString(),
          },
          metrics: metrics[0],
          activity,
          queue: {
            total: queue.reduce((sum, row) => sum + row.count, 0),
            counts,
          },
          automationMode:
            membership.store.knowledgeProfile?.automationMode ?? 'OFF',
          priorityQuestions,
          channels: channels.map(
            ({
              syncRuns,
              failureReason,
              questionSyncFailureReason,
              ...channel
            }) => ({
              ...channel,
              hasError: Boolean(
                failureReason ||
                questionSyncFailureReason ||
                channel.status === 'ERROR' ||
                syncRuns[0]?.status === 'FAILED',
              ),
              latestSync: syncRuns[0] ?? null,
            }),
          ),
          catalog: {
            ...catalog[0],
            freshnessMinutes: getInventoryFreshnessMaxAgeMs() / 60_000,
            lowStockThreshold: 5,
          },
          popularProducts: popular.flatMap((row) => {
            const product = products.find((item) => item.id === row.productId);
            return product
              ? [
                  {
                    id: product.id,
                    title: product.title,
                    brand: product.brand,
                    imageUrl: product.images[0]?.url ?? null,
                    questions: row._count.id,
                  },
                ]
              : [];
          }),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
  }
}
