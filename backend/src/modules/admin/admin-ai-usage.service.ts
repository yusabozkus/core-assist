import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingUsageMetric,
  ProductKnowledgeFactStatus,
  ProductQuestionStatus,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { activeBillingSubscriptionWhere } from '../billing/billing-access.policy';
import { entitlementsFor } from '../billing/billing-plan.config';
import {
  findBillingUsagePeriodForWindow,
  resolveBillingUsageWindow,
} from '../billing/billing-usage-window';
import {
  AdminAiUsagePeriod,
  AdminAiUsageQueryDto,
} from './dto/admin-ai-usage-query.dto';
import {
  AdminAiBlockerType,
  AdminAiBlockersQueryDto,
} from './dto/admin-ai-blockers-query.dto';

type DailyDraftRow = {
  day: Date;
  drafts: bigint;
  averageConfidence: number | null;
};

type CountRow = { count: bigint };
type IdRow = { id: string };

const blockerCopy: Record<
  AdminAiBlockerType,
  { title: string; description: string }
> = {
  [AdminAiBlockerType.GENERATION_FAILURES]: {
    title: 'AI üretim hataları',
    description: 'Taslak oluşturma işlemi tamamlanamayan ürün soruları.',
  },
  [AdminAiBlockerType.DELIVERY_FAILURES]: {
    title: 'Cevap gönderim hataları',
    description: 'Hazırlanan cevabı pazaryerine iletilemeyen sorular.',
  },
  [AdminAiBlockerType.QUOTA]: {
    title: 'Kota nedeniyle bekleyenler',
    description:
      'AI soru hakkı tükendiği için taslağı oluşturulamayan sorular.',
  },
  [AdminAiBlockerType.SUBSCRIPTION]: {
    title: 'Abonelik nedeniyle bekleyenler',
    description: 'Abonelik erişimi kapalı olduğu için işlenemeyen sorular.',
  },
  [AdminAiBlockerType.MISSING_INFORMATION]: {
    title: 'Eksik ürün bilgileri',
    description:
      'Güvenilir bir cevap için kullanıcıdan bilgi bekleyen sorular.',
  },
  [AdminAiBlockerType.KNOWLEDGE_CONFLICTS]: {
    title: 'Bilgi çakışmaları',
    description:
      'Ürün bilgi tabanında doğrulanması gereken çelişkili kayıtlar.',
  },
};

@Injectable()
export class AdminAiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getBlockers(type: AdminAiBlockerType, query: AdminAiBlockersQueryDto) {
    const skip = (query.page - 1) * query.pageSize;

    if (type === AdminAiBlockerType.DELIVERY_FAILURES) {
      const where = { status: QuestionAnswerStatus.FAILED } as const;
      const [total, answers] = await Promise.all([
        this.prisma.questionAnswer.count({ where }),
        this.prisma.questionAnswer.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: query.pageSize,
          select: {
            id: true,
            origin: true,
            composition: true,
            status: true,
            attempts: true,
            lastError: true,
            updatedAt: true,
            question: {
              select: {
                id: true,
                externalQuestionId: true,
                question: true,
                productTitleSnapshot: true,
                status: true,
              },
            },
            store: { select: adminBlockerStoreSelect },
          },
        }),
      ]);

      return blockerResult(
        type,
        total,
        answers.map((answer) => ({
          id: answer.id,
          kind: 'DELIVERY' as const,
          title: answer.question.productTitleSnapshot ?? 'Ürün sorusu',
          description: answer.question.question,
          error: answer.lastError,
          occurredAt: answer.updatedAt,
          status: answer.status,
          questionId: answer.question.id,
          externalQuestionId: answer.question.externalQuestionId,
          store: storeContext(answer.store),
          metadata: [
            { label: 'Kaynak', value: answer.origin },
            { label: 'Cevap biçimi', value: answer.composition },
            { label: 'Deneme', value: String(answer.attempts) },
          ],
        })),
        query,
      );
    }

    if (type === AdminAiBlockerType.KNOWLEDGE_CONFLICTS) {
      const where = { status: ProductKnowledgeFactStatus.CONFLICT } as const;
      const [total, facts] = await Promise.all([
        this.prisma.productKnowledgeFact.count({ where }),
        this.prisma.productKnowledgeFact.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: query.pageSize,
          select: {
            id: true,
            label: true,
            value: true,
            factType: true,
            scopeKey: true,
            status: true,
            updatedAt: true,
            product: { select: { title: true } },
            originatingQuestion: {
              select: {
                id: true,
                externalQuestionId: true,
                question: true,
              },
            },
            store: { select: adminBlockerStoreSelect },
          },
        }),
      ]);

      return blockerResult(
        type,
        total,
        facts.map((fact) => ({
          id: fact.id,
          kind: 'KNOWLEDGE' as const,
          title: fact.product.title,
          description: `${fact.label}: ${fact.value}`,
          error: 'Aynı bilgi alanı için çelişen bir kayıt bulunuyor.',
          occurredAt: fact.updatedAt,
          status: fact.status,
          questionId: fact.originatingQuestion?.id ?? null,
          externalQuestionId:
            fact.originatingQuestion?.externalQuestionId ?? null,
          store: storeContext(fact.store),
          metadata: [
            { label: 'Bilgi türü', value: fact.factType },
            { label: 'Kapsam', value: fact.scopeKey },
          ],
        })),
        query,
      );
    }

    if (type === AdminAiBlockerType.MISSING_INFORMATION) {
      const ids = await this.prisma.$queryRaw<IdRow[]>(Prisma.sql`
        SELECT question."id"
        FROM "product_question" AS question
        WHERE question."status" = 'DRAFTED'::"ProductQuestionStatus"
          AND question."draftDecision" = 'NEEDS_REVIEW'
          AND question."draftMissingInformation" IS NOT NULL
          AND question."draftMissingInformation"::text NOT IN ('[]', '{}', 'null')
          AND NOT EXISTS (
            SELECT 1
            FROM "question_answer" AS answer
            WHERE answer."questionId" = question."id"
          )
        ORDER BY question."updatedAt" DESC
        LIMIT ${query.pageSize}
        OFFSET ${skip}
      `);
      const countRows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM "product_question" AS question
        WHERE question."status" = 'DRAFTED'::"ProductQuestionStatus"
          AND question."draftDecision" = 'NEEDS_REVIEW'
          AND question."draftMissingInformation" IS NOT NULL
          AND question."draftMissingInformation"::text NOT IN ('[]', '{}', 'null')
          AND NOT EXISTS (
            SELECT 1
            FROM "question_answer" AS answer
            WHERE answer."questionId" = question."id"
          )
      `);
      const questions = ids.length
        ? await this.prisma.productQuestion.findMany({
            where: { id: { in: ids.map((row) => row.id) } },
            select: adminBlockerQuestionSelect,
          })
        : [];
      const questionById = new Map(
        questions.map((question) => [question.id, question]),
      );
      const ordered = ids
        .map((row) => questionById.get(row.id))
        .filter((question): question is NonNullable<typeof question> =>
          Boolean(question),
        );

      return blockerResult(
        type,
        Number(countRows[0]?.count ?? 0),
        ordered.map((question) =>
          questionBlockerItem(
            question,
            missingInformationMessage(question.draftMissingInformation),
            'NEEDS_REVIEW',
          ),
        ),
        query,
      );
    }

    const processingStatus = processingStatusFor(type);
    const where = {
      status: ProductQuestionStatus.PENDING,
      draftProcessingStatus: processingStatus,
    } as const;
    const [total, questions] = await Promise.all([
      this.prisma.productQuestion.count({ where }),
      this.prisma.productQuestion.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
        select: adminBlockerQuestionSelect,
      }),
    ]);

    return blockerResult(
      type,
      total,
      questions.map((question) =>
        questionBlockerItem(
          question,
          processingFallbackError(type),
          processingStatus,
        ),
      ),
      query,
    );
  }

  async getUsage(query: AdminAiUsageQueryDto) {
    const now = new Date();
    const days = periodDays(query.period);
    const periodStart = new Date(now);
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(periodStart.getUTCDate() - (days - 1));
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setUTCDate(previousPeriodStart.getUTCDate() - days);

    const [
      draftAggregate,
      previousDraftCount,
      decisionGroups,
      autoEligible,
      answerGroups,
      processingGroups,
      deliveryFailures,
      usageAggregate,
      quotaSubscriptions,
      storeGroups,
      modelGroups,
      missingInformationRows,
      knowledgeConflicts,
      dailyRows,
    ] = await Promise.all([
      this.prisma.aiDraftAttempt.aggregate({
        where: { createdAt: { gte: periodStart, lte: now } },
        _count: { _all: true },
        _avg: { confidence: true },
      }),
      this.prisma.aiDraftAttempt.count({
        where: { createdAt: { gte: previousPeriodStart, lt: periodStart } },
      }),
      this.prisma.aiDraftAttempt.groupBy({
        by: ['decision'],
        where: { createdAt: { gte: periodStart, lte: now } },
        _count: { _all: true },
      }),
      this.prisma.aiDraftAttempt.count({
        where: {
          createdAt: { gte: periodStart, lte: now },
          autoSendEligible: true,
        },
      }),
      this.prisma.questionAnswer.groupBy({
        by: ['origin', 'status'],
        where: { createdAt: { gte: periodStart, lte: now } },
        _count: { _all: true },
      }),
      this.prisma.productQuestion.groupBy({
        by: ['draftProcessingStatus'],
        where: {
          status: ProductQuestionStatus.PENDING,
          draftProcessingStatus: {
            in: [
              QuestionDraftProcessingStatus.FAILED,
              QuestionDraftProcessingStatus.BLOCKED_QUOTA,
              QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.questionAnswer.count({
        where: { status: QuestionAnswerStatus.FAILED },
      }),
      this.prisma.billingUsageEvent.aggregate({
        where: {
          metric: BillingUsageMetric.AI_QUESTION,
          createdAt: { gte: periodStart, lte: now },
        },
        _sum: { quantity: true },
      }),
      this.prisma.billingSubscription.findMany({
        where: activeBillingSubscriptionWhere(now),
        select: {
          workspaceId: true,
          plan: true,
          cycle: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          usagePeriodAnchor: true,
          usagePeriods: {
            where: { periodStart: { lte: now } },
            orderBy: { periodStart: 'desc' },
            take: 1,
            select: { periodStart: true, aiQuestionUnits: true },
          },
          workspace: {
            select: {
              name: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.aiDraftAttempt.groupBy({
        by: ['storeId'],
        where: { createdAt: { gte: periodStart, lte: now } },
        _count: { _all: true },
        _avg: { confidence: true },
      }),
      this.prisma.aiDraftAttempt.groupBy({
        by: ['model'],
        where: { createdAt: { gte: periodStart, lte: now } },
        _count: { _all: true },
        _avg: { confidence: true },
      }),
      this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM "product_question" AS question
        WHERE question."status" = 'DRAFTED'::"ProductQuestionStatus"
          AND question."draftDecision" = 'NEEDS_REVIEW'
          AND question."draftMissingInformation" IS NOT NULL
          AND question."draftMissingInformation"::text NOT IN ('[]', '{}', 'null')
          AND NOT EXISTS (
            SELECT 1
            FROM "question_answer" AS answer
            WHERE answer."questionId" = question."id"
          )
      `),
      this.prisma.productKnowledgeFact.count({
        where: { status: ProductKnowledgeFactStatus.CONFLICT },
      }),
      this.prisma.$queryRaw<DailyDraftRow[]>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', "createdAt") AS "day",
          COUNT(*)::bigint AS "drafts",
          AVG("confidence")::double precision AS "averageConfidence"
        FROM "ai_draft_attempt"
        WHERE "createdAt" >= ${periodStart} AND "createdAt" <= ${now}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY DATE_TRUNC('day', "createdAt") ASC
      `),
    ]);

    const totalDrafts = draftAggregate._count._all;
    const storeIds = storeGroups.map((group) => group.storeId);
    const stores = storeIds.length
      ? await this.prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: {
            id: true,
            name: true,
            workspace: { select: { id: true, name: true } },
          },
        })
      : [];
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const quotaUsage = quotaSubscriptions
      .map((subscription) => {
        const usageWindow = resolveBillingUsageWindow(subscription, now);
        const usage = findBillingUsagePeriodForWindow(
          subscription.usagePeriods,
          usageWindow,
        );
        const limit = entitlementsFor(
          subscription.plan,
          subscription.status,
        ).monthlyAiQuestions;
        return {
          workspaceId: subscription.workspaceId,
          workspaceName: subscription.workspace.name,
          ownerName: subscription.workspace.owner.name,
          ownerEmail: subscription.workspace.owner.email,
          plan: subscription.plan,
          status: subscription.status,
          used: usage?.aiQuestionUnits ?? 0,
          limit,
          utilization: limit
            ? Math.min(
                100,
                Math.round(((usage?.aiQuestionUnits ?? 0) / limit) * 100),
              )
            : 0,
          periodStart: usageWindow.start,
          periodEnd: usageWindow.end,
        };
      })
      .sort((left, right) => right.utilization - left.utilization)
      .slice(0, 8);

    const autoSent = answerCount(
      answerGroups,
      QuestionAnswerOrigin.AUTOMATION,
      QuestionAnswerStatus.SENT,
    );
    const autoFailed = answerCount(
      answerGroups,
      QuestionAnswerOrigin.AUTOMATION,
      QuestionAnswerStatus.FAILED,
    );
    const manualSent = answerCount(
      answerGroups,
      QuestionAnswerOrigin.MANUAL,
      QuestionAnswerStatus.SENT,
    );

    return {
      period: query.period,
      periodStart,
      periodEnd: now,
      summary: {
        totalDrafts,
        previousPeriodDrafts: previousDraftCount,
        draftChangePercentage: percentageChange(
          totalDrafts,
          previousDraftCount,
        ),
        averageConfidence: draftAggregate._avg.confidence,
        readyForSend: groupCount(
          decisionGroups,
          'decision',
          QuestionReplyDecision.READY_FOR_SEND,
        ),
        needsReview: groupCount(
          decisionGroups,
          'decision',
          QuestionReplyDecision.NEEDS_REVIEW,
        ),
        doNotReply: groupCount(
          decisionGroups,
          'decision',
          QuestionReplyDecision.DO_NOT_REPLY,
        ),
        autoSendEligible: autoEligible,
        autoSent,
        autoFailed,
        manualSent,
        billedAiQuestions: usageAggregate._sum.quantity ?? 0,
      },
      blockers: {
        generationFailures: groupCount(
          processingGroups,
          'draftProcessingStatus',
          QuestionDraftProcessingStatus.FAILED,
        ),
        deliveryFailures,
        quota: groupCount(
          processingGroups,
          'draftProcessingStatus',
          QuestionDraftProcessingStatus.BLOCKED_QUOTA,
        ),
        subscription: groupCount(
          processingGroups,
          'draftProcessingStatus',
          QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION,
        ),
        missingInformation: Number(missingInformationRows[0]?.count ?? 0),
        knowledgeConflicts,
      },
      quotaUsage,
      topStores: storeGroups
        .map((group) => {
          const store = storeById.get(group.storeId);
          return store
            ? {
                store,
                drafts: group._count._all,
                averageConfidence: group._avg.confidence,
              }
            : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((left, right) => right.drafts - left.drafts)
        .slice(0, 8),
      models: modelGroups
        .map((group) => ({
          model: group.model,
          drafts: group._count._all,
          averageConfidence: group._avg.confidence,
        }))
        .sort((left, right) => right.drafts - left.drafts),
      daily: fillDailySeries(dailyRows, periodStart, now),
      generatedAt: now,
    };
  }
}

const adminBlockerStoreSelect = {
  id: true,
  name: true,
  workspace: {
    select: {
      id: true,
      name: true,
      owner: { select: { name: true, email: true } },
    },
  },
} satisfies Prisma.StoreSelect;

const adminBlockerQuestionSelect = {
  id: true,
  externalQuestionId: true,
  question: true,
  productTitleSnapshot: true,
  status: true,
  draftProcessingStatus: true,
  draftProcessingError: true,
  draftMissingInformation: true,
  updatedAt: true,
  store: { select: adminBlockerStoreSelect },
} satisfies Prisma.ProductQuestionSelect;

type AdminBlockerQuestion = Prisma.ProductQuestionGetPayload<{
  select: typeof adminBlockerQuestionSelect;
}>;

function processingStatusFor(type: AdminAiBlockerType) {
  if (type === AdminAiBlockerType.GENERATION_FAILURES) {
    return QuestionDraftProcessingStatus.FAILED;
  }
  if (type === AdminAiBlockerType.QUOTA) {
    return QuestionDraftProcessingStatus.BLOCKED_QUOTA;
  }
  return QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION;
}

function questionBlockerItem(
  question: AdminBlockerQuestion,
  fallbackError?: string,
  statusOverride?: string,
) {
  return {
    id: question.id,
    kind: 'QUESTION' as const,
    title: question.productTitleSnapshot ?? 'Ürün sorusu',
    description: question.question,
    error: question.draftProcessingError ?? fallbackError ?? null,
    occurredAt: question.updatedAt,
    status: statusOverride ?? question.draftProcessingStatus ?? question.status,
    questionId: question.id,
    externalQuestionId: question.externalQuestionId,
    store: storeContext(question.store),
    metadata: [],
  };
}

function processingFallbackError(type: AdminAiBlockerType) {
  if (type === AdminAiBlockerType.QUOTA) {
    return 'Müşteri hesabının AI soru kotası dolduğu için işlem bekletiliyor.';
  }
  if (type === AdminAiBlockerType.SUBSCRIPTION) {
    return 'Müşteri hesabının abonelik erişimi kapalı olduğu için işlem bekletiliyor.';
  }
  return 'Taslak oluşturma işlemi başarısız oldu; ayrıntılı hata kaydedilmedi.';
}

function storeContext(store: {
  id: string;
  name: string;
  workspace: {
    id: string;
    name: string;
    owner: { name: string; email: string };
  };
}) {
  return {
    id: store.id,
    name: store.name,
    account: store.workspace,
  };
}

function blockerResult<T>(
  type: AdminAiBlockerType,
  total: number,
  items: T[],
  query: AdminAiBlockersQueryDto,
) {
  return {
    type,
    ...blockerCopy[type],
    total,
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    generatedAt: new Date(),
  };
}

function missingInformationMessage(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return 'Gerekli ürün bilgisi belirtilmemiş.';
  const values = value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
  return values.length
    ? `Eksik bilgi: ${values.join(', ')}`
    : 'Gerekli ürün bilgisi belirtilmemiş.';
}

function periodDays(period: AdminAiUsagePeriod) {
  if (period === AdminAiUsagePeriod.WEEK) return 7;
  if (period === AdminAiUsagePeriod.QUARTER) return 90;
  return 30;
}

function groupCount<K extends string, V extends string>(
  groups: Array<Record<K, V | null> & { _count: { _all: number } }>,
  key: K,
  value: V,
) {
  return groups.find((group) => group[key] === value)?._count._all ?? 0;
}

function answerCount(
  groups: Array<{
    origin: QuestionAnswerOrigin;
    status: QuestionAnswerStatus;
    _count: { _all: number };
  }>,
  origin: QuestionAnswerOrigin,
  status: QuestionAnswerStatus,
) {
  return (
    groups.find((group) => group.origin === origin && group.status === status)
      ?._count._all ?? 0
  );
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function fillDailySeries(rows: DailyDraftRow[], start: Date, end: Date) {
  const byDay = new Map(rows.map((row) => [dayKey(row.day), row] as const));
  const values: Array<{
    date: string;
    drafts: number;
    averageConfidence: number | null;
  }> = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const finalDay = new Date(end);
  finalDay.setUTCHours(0, 0, 0, 0);

  while (cursor <= finalDay) {
    const date = dayKey(cursor);
    const row = byDay.get(date);
    values.push({
      date,
      drafts: row ? Number(row.drafts) : 0,
      averageConfidence: row?.averageConfidence ?? null,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values;
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
