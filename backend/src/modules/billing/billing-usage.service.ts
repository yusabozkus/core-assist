import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AiDraftOutcome,
  BillingUsageMetric,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from './billing.errors';
import { entitlementsFor } from './billing-plan.config';
import { BillingSubscriptionService } from './billing-subscription.service';

type ConsumeAiQuestionInput = {
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Prisma.InputJsonValue;
  quantity?: number;
};

type SuccessfulDraftUsageInput = {
  storeId: string;
  questionId: string;
  draftAttemptId: string;
  trigger: 'MANUAL' | 'AUTOMATION';
};

type BillingUsageClient = Pick<
  Prisma.TransactionClient,
  'billingUsagePeriod' | 'billingUsageEvent'
>;

@Injectable()
export class BillingUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: BillingSubscriptionService,
  ) {}

  async getCurrentForWorkspace(workspaceId: string, now = new Date()) {
    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      workspaceId,
      now,
    );
    const window = this.subscriptions.resolveUsageWindow(subscription, now);
    const period = await this.prisma.billingUsagePeriod.findUnique({
      where: {
        workspaceId_periodStart: {
          workspaceId,
          periodStart: window.start,
        },
      },
      select: { id: true, aiQuestionUnits: true },
    });
    const limit = entitlementsFor(
      subscription.plan,
      subscription.status,
    ).monthlyAiQuestions;
    const used = period?.aiQuestionUnits ?? 0;

    return {
      periodId: period?.id ?? null,
      periodStart: window.start,
      periodEnd: window.end,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: limit === 0 ? 100 : Math.min(100, (used / limit) * 100),
    };
  }

  async assertAiQuestionAvailable(
    workspaceId: string,
    idempotencyKey?: string,
    now = new Date(),
  ) {
    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      workspaceId,
      now,
    );
    if (!this.subscriptions.hasAccess(subscription, now)) {
      throw new BillingAccessRequiredException();
    }

    if (idempotencyKey) {
      const existing = await this.prisma.billingUsageEvent.findUnique({
        where: {
          workspaceId_idempotencyKey: { workspaceId, idempotencyKey },
        },
        select: { id: true },
      });
      if (existing) return;
    }

    const usage = await this.getCurrentForWorkspace(workspaceId, now);
    if (usage.remaining < 1) {
      throw new BillingQuotaExceededException(usage.limit);
    }
  }

  async assertDraftGenerationAvailableForStore(
    storeId: string,
    questionId: string,
    now = new Date(),
  ) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { workspaceId: true },
    });
    if (!store) throw new NotFoundException('Mağaza bulunamadı.');

    const successfulDrafts = await this.prisma.aiDraftAttempt.count({
      where: {
        storeId,
        questionId,
        outcome: { not: AiDraftOutcome.FAILED },
      },
    });
    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      store.workspaceId,
      now,
    );
    if (!this.subscriptions.hasAccess(subscription, now)) {
      throw new BillingAccessRequiredException();
    }

    const includedRegeneration = successfulDrafts > 0 && successfulDrafts < 3;
    await this.assertAiQuestionAvailable(
      store.workspaceId,
      successfulDrafts === 0 ? `ai-question:${questionId}` : undefined,
      now,
    );

    return {
      successfulDrafts,
      consumesUnit: !includedRegeneration,
    };
  }

  async consumeSuccessfulDraft(
    transaction: Prisma.TransactionClient,
    input: SuccessfulDraftUsageInput,
    now = new Date(),
  ) {
    const store = await transaction.store.findUnique({
      where: { id: input.storeId },
      select: { workspaceId: true },
    });
    if (!store) throw new NotFoundException('Mağaza bulunamadı.');

    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      store.workspaceId,
      now,
      transaction,
    );
    if (!this.subscriptions.hasAccess(subscription, now)) {
      throw new BillingAccessRequiredException();
    }

    const draftOrdinal = await transaction.aiDraftAttempt.count({
      where: {
        storeId: input.storeId,
        questionId: input.questionId,
        outcome: { not: AiDraftOutcome.FAILED },
      },
    });
    if (draftOrdinal > 1 && draftOrdinal <= 3) {
      const limit = entitlementsFor(
        subscription.plan,
        subscription.status,
      ).monthlyAiQuestions;
      const window = this.subscriptions.resolveUsageWindow(subscription, now);
      const period = await transaction.billingUsagePeriod.findUnique({
        where: {
          workspaceId_periodStart: {
            workspaceId: store.workspaceId,
            periodStart: window.start,
          },
        },
        select: { aiQuestionUnits: true },
      });
      return {
        ...usageResult(period?.aiQuestionUnits ?? 0, limit, false),
        draftOrdinal,
      };
    }

    const result = await this.consumeAiQuestionWithClient(
      transaction,
      store.workspaceId,
      subscription,
      {
        idempotencyKey:
          draftOrdinal === 1
            ? `ai-question:${input.questionId}`
            : `ai-draft:${input.draftAttemptId}`,
        sourceType: 'AI_DRAFT_ATTEMPT',
        sourceId: input.draftAttemptId,
        metadata: {
          questionId: input.questionId,
          draftOrdinal,
          trigger: input.trigger,
        },
      },
      now,
    );

    return { ...result, draftOrdinal };
  }

  async consumeAiQuestionForStore(
    storeId: string,
    input: ConsumeAiQuestionInput,
    now = new Date(),
  ) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { workspaceId: true },
    });
    if (!store) throw new NotFoundException('Mağaza bulunamadı.');

    return this.consumeAiQuestion(store.workspaceId, input, now);
  }

  async consumeAiQuestion(
    workspaceId: string,
    input: ConsumeAiQuestionInput,
    now = new Date(),
  ) {
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('Kullanım miktarı pozitif bir tam sayı olmalıdır.');
    }

    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      workspaceId,
      now,
    );
    if (!this.subscriptions.hasAccess(subscription, now)) {
      throw new BillingAccessRequiredException();
    }

    try {
      return await this.prisma.$transaction((transaction) =>
        this.consumeAiQuestionWithClient(
          transaction,
          workspaceId,
          subscription,
          input,
          now,
        ),
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const usage = await this.getCurrentForWorkspace(workspaceId, now);
        return usageResult(
          usage.used,
          usage.limit,
          false,
          usage.periodId,
          usage.used,
        );
      }
      throw error;
    }
  }

  private async consumeAiQuestionWithClient(
    client: BillingUsageClient,
    workspaceId: string,
    subscription: Awaited<
      ReturnType<BillingSubscriptionService['getOrCreateForWorkspace']>
    >,
    input: ConsumeAiQuestionInput,
    now: Date,
  ) {
    const quantity = input.quantity ?? 1;
    const limit = entitlementsFor(
      subscription.plan,
      subscription.status,
    ).monthlyAiQuestions;
    const window = this.subscriptions.resolveUsageWindow(subscription, now);
    const period = await client.billingUsagePeriod.upsert({
      where: {
        workspaceId_periodStart: {
          workspaceId,
          periodStart: window.start,
        },
      },
      create: {
        workspaceId,
        subscriptionId: subscription.id,
        periodStart: window.start,
        periodEnd: window.end,
      },
      update: {
        subscriptionId: subscription.id,
        periodEnd: window.end,
      },
    });

    const existing = await client.billingUsageEvent.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return usageResult(
        period.aiQuestionUnits,
        limit,
        false,
        period.id,
        period.aiQuestionUnits,
      );
    }

    const incremented = await client.billingUsagePeriod.updateMany({
      where: {
        id: period.id,
        aiQuestionUnits: { lte: limit - quantity },
      },
      data: { aiQuestionUnits: { increment: quantity } },
    });
    if (incremented.count !== 1) {
      throw new BillingQuotaExceededException(limit);
    }

    await client.billingUsageEvent.create({
      data: {
        workspaceId,
        usagePeriodId: period.id,
        metric: BillingUsageMetric.AI_QUESTION,
        quantity,
        idempotencyKey: input.idempotencyKey,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        metadata: input.metadata,
      },
    });

    return usageResult(
      period.aiQuestionUnits + quantity,
      limit,
      true,
      period.id,
      period.aiQuestionUnits,
    );
  }
}

function usageResult(
  used: number,
  limit: number,
  charged: boolean,
  periodId: string | null = null,
  previousUsed = used,
) {
  return {
    charged,
    periodId,
    previousUsed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
