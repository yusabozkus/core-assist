import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AiAutomationMode,
  QuestionAnswerComposition,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ProductAnswerFact } from '../questions/product-answer-context.types';
import {
  AiPerformanceQueryDto,
  AiPerformanceRange,
} from './dto/ai-performance-query.dto';

type ProviderMetric = {
  providerKey: string;
  totalDrafts: number;
  confidenceTotal: number;
  readyDrafts: number;
  needsReviewDrafts: number;
  sentAnswers: number;
  acceptedUnchanged: number;
  editedAnswers: number;
  autoSentAnswers: number;
};

type IntentMetric = {
  intent: ProductAnswerFact;
  totalDrafts: number;
  confidenceTotal: number;
  readyDrafts: number;
  needsReviewDrafts: number;
  eligibleDrafts: number;
  sentAnswers: number;
  editedAnswers: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAiPerformance(
    storeId: string,
    userId: string,
    query: AiPerformanceQueryDto,
  ) {
    await this.requireMembership(storeId, userId);

    const from = resolveRangeStart(query.range);
    const attemptWhere: Prisma.AiDraftAttemptWhereInput = {
      storeId,
      ...(from ? { createdAt: { gte: from } } : {}),
      ...(query.provider
        ? {
            question: {
              connection: { providerKey: query.provider },
            },
          }
        : {}),
    };
    const deliveryWhere: Prisma.QuestionAnswerWhereInput = {
      storeId,
      ...(from ? { queuedAt: { gte: from } } : {}),
      ...(query.provider
        ? { connection: { providerKey: query.provider } }
        : {}),
    };

    const [attempts, deliveries] = await Promise.all([
      this.prisma.aiDraftAttempt.findMany({
        where: attemptWhere,
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
      }),
      this.prisma.questionAnswer.findMany({
        where: deliveryWhere,
        select: {
          id: true,
          draftAttemptId: true,
          origin: true,
          composition: true,
          status: true,
          connection: { select: { providerKey: true } },
        },
      }),
    ]);

    const totalDrafts = attempts.length;
    const readyDrafts = attempts.filter(
      (attempt) => attempt.decision === QuestionReplyDecision.READY_FOR_SEND,
    ).length;
    const needsReviewDrafts = attempts.filter(
      (attempt) => attempt.decision === QuestionReplyDecision.NEEDS_REVIEW,
    ).length;
    const averageConfidence = average(
      attempts.map((attempt) => attempt.confidence),
    );
    const shadowAttempts = attempts.filter(
      (attempt) => attempt.automationMode === AiAutomationMode.SHADOW,
    );
    const shadowEligibleAttempts = shadowAttempts.filter(
      (attempt) => attempt.autoSendEligible,
    );
    const sentDeliveries = deliveries.filter(
      (delivery) => delivery.status === QuestionAnswerStatus.SENT,
    );
    const aiSentDeliveries = sentDeliveries.filter(
      (delivery) => delivery.draftAttemptId !== null,
    );
    const manuallyReviewedAiAnswers = aiSentDeliveries.filter(
      (delivery) => delivery.origin === QuestionAnswerOrigin.MANUAL,
    );
    const acceptedUnchanged = manuallyReviewedAiAnswers.filter(
      (delivery) =>
        delivery.composition === QuestionAnswerComposition.AI_UNCHANGED,
    ).length;
    const editedAnswers = manuallyReviewedAiAnswers.filter(
      (delivery) =>
        delivery.composition === QuestionAnswerComposition.AI_EDITED,
    ).length;
    const autoSentAnswers = aiSentDeliveries.filter(
      (delivery) => delivery.origin === QuestionAnswerOrigin.AUTOMATION,
    ).length;
    const aiDeliveryAttempts = deliveries.filter(
      (delivery) => delivery.draftAttemptId !== null,
    );
    const failedAiDeliveries = aiDeliveryAttempts.filter(
      (delivery) => delivery.status === QuestionAnswerStatus.FAILED,
    ).length;

    const providerMetrics = new Map<string, ProviderMetric>();
    const intentMetrics = new Map<ProductAnswerFact, IntentMetric>();
    for (const attempt of attempts) {
      const providerKey = attempt.question.connection.providerKey;
      const metric = getProviderMetric(providerMetrics, providerKey);
      metric.totalDrafts += 1;
      metric.confidenceTotal += attempt.confidence;
      if (attempt.decision === QuestionReplyDecision.READY_FOR_SEND) {
        metric.readyDrafts += 1;
      } else if (attempt.decision === QuestionReplyDecision.NEEDS_REVIEW) {
        metric.needsReviewDrafts += 1;
      }

      const intents = toRequestedFacts(attempt.requestedFacts);
      const normalizedIntents: ProductAnswerFact[] =
        intents.length > 0 ? intents : ['PRODUCT_INFO'];
      for (const intent of normalizedIntents) {
        const intentMetric = getIntentMetric(intentMetrics, intent);
        intentMetric.totalDrafts += 1;
        intentMetric.confidenceTotal += attempt.confidence;
        if (attempt.decision === QuestionReplyDecision.READY_FOR_SEND) {
          intentMetric.readyDrafts += 1;
        } else if (attempt.decision === QuestionReplyDecision.NEEDS_REVIEW) {
          intentMetric.needsReviewDrafts += 1;
        }
        if (attempt.autoSendEligible) intentMetric.eligibleDrafts += 1;
        if (attempt.answerDelivery?.status === QuestionAnswerStatus.SENT) {
          intentMetric.sentAnswers += 1;
          if (
            attempt.answerDelivery.composition ===
            QuestionAnswerComposition.AI_EDITED
          ) {
            intentMetric.editedAnswers += 1;
          }
        }
      }
    }
    for (const delivery of sentDeliveries) {
      const metric = getProviderMetric(
        providerMetrics,
        delivery.connection.providerKey,
      );
      metric.sentAnswers += 1;
      if (
        delivery.origin === QuestionAnswerOrigin.MANUAL &&
        delivery.composition === QuestionAnswerComposition.AI_UNCHANGED
      ) {
        metric.acceptedUnchanged += 1;
      }
      if (
        delivery.origin === QuestionAnswerOrigin.MANUAL &&
        delivery.composition === QuestionAnswerComposition.AI_EDITED
      ) {
        metric.editedAnswers += 1;
      }
      if (
        delivery.draftAttemptId &&
        delivery.origin === QuestionAnswerOrigin.AUTOMATION
      ) {
        metric.autoSentAnswers += 1;
      }
    }

    return {
      range: query.range,
      from: from?.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
      summary: {
        totalDrafts,
        averageConfidence,
        readyRate: percentage(readyDrafts, totalDrafts),
        needsReviewRate: percentage(needsReviewDrafts, totalDrafts),
        acceptanceRate: percentage(
          acceptedUnchanged,
          acceptedUnchanged + editedAnswers,
        ),
        editRate: percentage(editedAnswers, acceptedUnchanged + editedAnswers),
        aiCoverageRate: percentage(
          aiSentDeliveries.length,
          sentDeliveries.length,
        ),
        deliverySuccessRate: percentage(
          aiSentDeliveries.length,
          aiSentDeliveries.length + failedAiDeliveries,
        ),
        shadowEligibilityRate: percentage(
          shadowEligibleAttempts.length,
          shadowAttempts.length,
        ),
      },
      answers: {
        totalSent: sentDeliveries.length,
        aiAssisted: aiSentDeliveries.length,
        acceptedUnchanged,
        edited: editedAnswers,
        autoSent: autoSentAnswers,
        manualOnly: sentDeliveries.filter(
          (delivery) => delivery.draftAttemptId === null,
        ).length,
      },
      draftDecisions: {
        ready: readyDrafts,
        needsReview: needsReviewDrafts,
      },
      shadow: {
        evaluated: shadowAttempts.length,
        wouldAutoSend: shadowEligibleAttempts.length,
        keptForReview: shadowAttempts.length - shadowEligibleAttempts.length,
      },
      providers: [...providerMetrics.values()]
        .map((metric) => ({
          providerKey: metric.providerKey,
          totalDrafts: metric.totalDrafts,
          averageConfidence:
            metric.totalDrafts > 0
              ? round(metric.confidenceTotal / metric.totalDrafts)
              : 0,
          readyRate: percentage(metric.readyDrafts, metric.totalDrafts),
          needsReviewRate: percentage(
            metric.needsReviewDrafts,
            metric.totalDrafts,
          ),
          sentAnswers: metric.sentAnswers,
          acceptedUnchanged: metric.acceptedUnchanged,
          editedAnswers: metric.editedAnswers,
          autoSentAnswers: metric.autoSentAnswers,
        }))
        .sort((left, right) => right.totalDrafts - left.totalDrafts),
      intents: [...intentMetrics.values()]
        .map((metric) => ({
          intent: metric.intent,
          totalDrafts: metric.totalDrafts,
          averageConfidence:
            metric.totalDrafts > 0
              ? round(metric.confidenceTotal / metric.totalDrafts)
              : 0,
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
          editRate: percentage(metric.editedAnswers, metric.sentAnswers),
        }))
        .sort((left, right) => right.totalDrafts - left.totalDrafts),
      recentActivity: attempts.slice(0, 8).map((attempt) => ({
        id: attempt.id,
        questionId: attempt.question.id,
        question: attempt.question.question,
        customerName: attempt.question.customerName,
        productTitle: attempt.question.product?.title ?? null,
        providerKey: attempt.question.connection.providerKey,
        trigger: attempt.trigger,
        outcome: attempt.outcome,
        decision: attempt.decision,
        confidence: round(attempt.confidence),
        requestedFacts: toRequestedFacts(attempt.requestedFacts),
        automationMode: attempt.automationMode,
        autoSendEligible: attempt.autoSendEligible,
        appliedConfidenceThreshold: round(attempt.appliedConfidenceThreshold),
        composition: attempt.answerDelivery?.composition ?? null,
        deliveryStatus: attempt.answerDelivery?.status ?? null,
        createdAt: attempt.createdAt.toISOString(),
        sentAt: attempt.answerDelivery?.sentAt?.toISOString() ?? null,
      })),
    };
  }

  private async requireMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findFirst({
      where: { storeId, userId, store: { status: StoreStatus.ACTIVE } },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }
  }
}

function resolveRangeStart(range: AiPerformanceRange) {
  if (range === AiPerformanceRange.ALL) return null;

  const days =
    range === AiPerformanceRange.SEVEN_DAYS
      ? 7
      : range === AiPerformanceRange.NINETY_DAYS
        ? 90
        : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}

function getProviderMetric(
  metrics: Map<string, ProviderMetric>,
  providerKey: string,
) {
  const existing = metrics.get(providerKey);
  if (existing) return existing;

  const metric: ProviderMetric = {
    providerKey,
    totalDrafts: 0,
    confidenceTotal: 0,
    readyDrafts: 0,
    needsReviewDrafts: 0,
    sentAnswers: 0,
    acceptedUnchanged: 0,
    editedAnswers: 0,
    autoSentAnswers: 0,
  };
  metrics.set(providerKey, metric);
  return metric;
}

function getIntentMetric(
  metrics: Map<ProductAnswerFact, IntentMetric>,
  intent: ProductAnswerFact,
) {
  const existing = metrics.get(intent);
  if (existing) return existing;

  const metric: IntentMetric = {
    intent,
    totalDrafts: 0,
    confidenceTotal: 0,
    readyDrafts: 0,
    needsReviewDrafts: 0,
    eligibleDrafts: 0,
    sentAnswers: 0,
    editedAnswers: 0,
  };
  metrics.set(intent, metric);
  return metric;
}

const PRODUCT_ANSWER_FACTS = new Set<ProductAnswerFact>([
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
]);

function toRequestedFacts(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ProductAnswerFact =>
      typeof item === 'string' &&
      PRODUCT_ANSWER_FACTS.has(item as ProductAnswerFact),
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function percentage(value: number, total: number) {
  if (total === 0) return 0;
  return round((value / total) * 100);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
