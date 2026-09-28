import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiAutomationMode,
  AiDraftOutcome,
  AiDraftTrigger,
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { InventoryVerificationService } from '../inventory-verification/inventory-verification.service';
import { BillingUsageService } from '../billing/billing-usage.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import { BillingUsageNotificationService } from '../billing/billing-usage-notification.service';
import {
  AiDraftGenerator,
  AiDraftRateLimitError,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import {
  analyzeProductQuestion,
  ProductAnswerContextService,
} from './product-answer-context.service';
import type { InventoryVerificationResult } from '../inventory-verification/inventory-verification.types';
import type {
  DraftQuestionAnswer,
  ProductAnswerContext,
} from './product-answer-context.types';
import { QuestionProductLinkService } from '../question-product-link/question-product-link.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import {
  DEFAULT_AUTO_SEND_CONFIDENCE,
  evaluateAutoSendEligibility,
} from './ai-auto-send-policy';
import {
  DraftExecutionService,
  type DraftExecution,
} from './draft-execution.service';
import { getUnlistedAvailabilitySize } from './unlisted-size-availability';

type GenerateDraftOptions = {
  trigger?: 'MANUAL' | 'AUTOMATION';
  requestedByUserId?: string;
};

@Injectable()
export class QuestionDraftService {
  private readonly logger = new Logger(QuestionDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productContext: ProductAnswerContextService,
    private readonly inventoryVerification: InventoryVerificationService,
    private readonly aiDrafts: AiDraftGenerator,
    private readonly responsePolicy: QuestionResponsePolicyService,
    private readonly replyDecision: QuestionReplyDecisionService,
    private readonly productLinks: QuestionProductLinkService,
    private readonly billingUsage: BillingUsageService,
    private readonly billingUsageNotifications: BillingUsageNotificationService,
    private readonly billing: BillingSubscriptionService,
    private readonly executions: DraftExecutionService,
  ) {}

  async generate(
    storeId: string,
    questionId: string,
    options: GenerateDraftOptions = {},
  ): Promise<DraftQuestionAnswer> {
    return this.executions.run(storeId, questionId, (execution) =>
      this.generateClaimed(storeId, questionId, options, execution),
    );
  }

  private async generateClaimed(
    storeId: string,
    questionId: string,
    options: GenerateDraftOptions,
    execution: DraftExecution,
  ): Promise<DraftQuestionAnswer> {
    const policyQuestion = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        question: true,
        status: true,
        answerDelivery: { select: { status: true } },
      },
    });

    if (!policyQuestion) {
      throw new NotFoundException('Ürün sorusu bulunamadı.');
    }

    if (
      policyQuestion.answerDelivery?.status === QuestionAnswerStatus.QUEUED ||
      policyQuestion.answerDelivery?.status ===
        QuestionAnswerStatus.PROCESSING ||
      policyQuestion.answerDelivery?.status === QuestionAnswerStatus.SENT ||
      policyQuestion.answerDelivery?.status ===
        QuestionAnswerStatus.REVIEW_REQUIRED
    ) {
      throw new ConflictException(
        'Gönderim süreci başlamış bir soru için yeni taslak oluşturulamaz.',
      );
    }

    const policyDecision = this.responsePolicy.evaluate(
      policyQuestion.question,
    );
    if (policyDecision.action === 'DO_NOT_REPLY') {
      if (policyQuestion.status !== ProductQuestionStatus.IGNORED) {
        const ignored = await this.prisma.productQuestion.updateMany({
          where: {
            id: questionId,
            storeId,
            status: {
              in: [
                ProductQuestionStatus.PENDING,
                ProductQuestionStatus.DRAFTED,
              ],
            },
            answerDelivery: { is: null },
          },
          data: {
            answer: null,
            status: ProductQuestionStatus.IGNORED,
            draftDecision: QuestionReplyDecision.DO_NOT_REPLY,
            draftConfidence: null,
            draftAnswerability: null,
            draftRisks: [],
            draftMissingInformation: [],
            draftEvidenceIds: [],
            draftModel: null,
            draftedAt: new Date(),
            draftProcessingStatus: null,
            draftProcessingError: null,
            draftQueuedAt: null,
            draftProcessingStartedAt: null,
          },
        });

        if (ignored.count !== 1) {
          throw new ConflictException(
            'Soru yanıtlanmayacak olarak işaretlenirken durumu değişti.',
          );
        }
      }

      return {
        answer: null,
        status: 'IGNORED',
        context: {
          source: 'POLICY',
          model: null,
          decision: 'DO_NOT_REPLY',
          policyReason: policyDecision.reason,
        },
      };
    }

    await this.billingUsage.assertDraftGenerationAvailableForStore(
      storeId,
      questionId,
    );

    await this.productLinks.linkQuestionIfPossible(storeId, questionId);
    let context = await this.productContext.build(storeId, questionId);
    let inventorySnapshotHash: string | null = null;
    let inventoryCheckAttempted = false;
    const verifyInventory = async () => {
      inventoryCheckAttempted = true;
      try {
        const verification =
          await this.inventoryVerification.verifyQuestionProduct(
            storeId,
            questionId,
          );
        if (verification.productId !== context.product.id) {
          throw new ConflictException('Sorunun ürün eşleşmesi değişti.');
        }
        context = applyVerifiedInventory(context, verification);
        inventorySnapshotHash = verification.snapshotHash;
      } catch (error) {
        if (error instanceof BillingAccessRequiredException) throw error;
        this.logger.warn(`${questionId} sorusu için canlı stok doğrulanamadı.`);
        context = markInventoryAsUnverified(context);
      }
    };
    let aiDraft: AiDraftResult | null;

    try {
      if (
        context.requestedFacts.includes('STOCK') &&
        !getUnlistedAvailabilitySize(context)
      ) {
        await verifyInventory();
      }
      await this.billing.assertStoreAccess(storeId);
      await execution.assertActive();
      aiDraft = await this.aiDrafts.generate(context);
      if (
        aiDraft &&
        !inventoryCheckAttempted &&
        !getUnlistedAvailabilitySize(context) &&
        (aiDraft.detectedFacts.includes('STOCK') ||
          aiDraft.usedFacts.includes('STOCK') ||
          aiDraft.usedEvidenceIds.includes('variant-stock'))
      ) {
        await verifyInventory();
        // Discard the first answer: it was composed before the provider check.
        await this.billing.assertStoreAccess(storeId);
        await execution.assertActive();
        aiDraft = await this.aiDrafts.generate(context);
      }
    } catch (error) {
      if (error instanceof AiDraftRateLimitError) {
        const retryAfterSeconds = error.retryAfterSeconds ?? 60;
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'AI_RATE_LIMITED',
            message: `AI kullanım limiti geçici olarak doldu. ${retryAfterSeconds} saniye sonra tekrar deneyin.`,
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw error;
    }

    if (!aiDraft) {
      throw new ServiceUnavailableException(
        'AI taslağı şu anda oluşturulamadı. Lütfen daha sonra tekrar deneyin.',
      );
    }

    const guardedDraft = applyInventoryFreshnessGuard(aiDraft, context);
    const answer = guardedDraft.answer;
    const replyDecision = this.replyDecision.evaluate(guardedDraft);
    const automationMode =
      context.responsePreferences?.automationMode ?? AiAutomationMode.OFF;
    const autoSend = evaluateAutoSendEligibility({
      draft: guardedDraft,
      decision: replyDecision,
      requestedFacts: context.requestedFacts,
      storeMinimumConfidence:
        context.responsePreferences?.minimumAutoSendConfidence ??
        DEFAULT_AUTO_SEND_CONFIDENCE,
      allowHeightWeightRecommendation:
        context.heightWeightSizeRecommendation?.status === 'ESTIMATE_ALLOWED' ||
        context.heightWeightSizeRecommendation?.status === 'MATCHED',
    });
    const draftedAt = new Date();
    const draftAttempt = await this.prisma.$transaction(async (transaction) => {
      // Lock/fence the lease in the same transaction as the draft and quota.
      await execution.assertActive(transaction);
      await transaction.aiDraftAttempt.updateMany({
        where: {
          storeId,
          questionId,
          outcome: AiDraftOutcome.AVAILABLE,
        },
        data: {
          outcome: AiDraftOutcome.SUPERSEDED,
          finalizedAt: draftedAt,
        },
      });

      const attempt = await transaction.aiDraftAttempt.create({
        data: {
          storeId,
          questionId,
          requestedByUserId: options.requestedByUserId,
          trigger:
            options.trigger === 'AUTOMATION'
              ? AiDraftTrigger.AUTOMATION
              : AiDraftTrigger.MANUAL,
          answer,
          decision: replyDecision,
          confidence: guardedDraft.confidence,
          answerability: guardedDraft.answerability,
          risks: guardedDraft.risks,
          missingInformation: guardedDraft.missingInformation,
          evidenceIds: guardedDraft.usedEvidenceIds,
          model: guardedDraft.model,
          interpretation: guardedDraft.interpretation,
          requestedFacts: context.requestedFacts,
          detectedFacts: guardedDraft.detectedFacts,
          automationMode,
          autoSendEligible: autoSend.eligible,
          appliedConfidenceThreshold: autoSend.appliedConfidenceThreshold,
          eligibilityReasons: autoSend.reasons,
          inventorySnapshotHash,
        },
        select: { id: true },
      });

      const updated = await transaction.productQuestion.updateMany({
        where: {
          id: questionId,
          storeId,
          status: {
            in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
          },
          OR: [
            { answerDelivery: { is: null } },
            { answerDelivery: { is: { status: QuestionAnswerStatus.FAILED } } },
          ],
        },
        data: {
          answer,
          status: ProductQuestionStatus.DRAFTED,
          draftDecision: replyDecision,
          draftConfidence: guardedDraft.confidence,
          draftAnswerability: guardedDraft.answerability,
          draftRisks: guardedDraft.risks,
          draftMissingInformation: guardedDraft.missingInformation,
          draftEvidenceIds: guardedDraft.usedEvidenceIds,
          draftModel: guardedDraft.model,
          draftedAt,
          draftProcessingStatus: null,
          draftProcessingError: null,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Taslak oluşturulurken soru durumu değişti.',
        );
      }

      const billingUsage = await this.billingUsage.consumeSuccessfulDraft(
        transaction,
        {
          storeId,
          questionId,
          draftAttemptId: attempt.id,
          trigger: options.trigger === 'AUTOMATION' ? 'AUTOMATION' : 'MANUAL',
        },
        draftedAt,
      );

      return { attempt, billingUsage };
    });

    await this.billingUsageNotifications.notifyAiQuestionThreshold(
      storeId,
      draftAttempt.billingUsage,
    );

    return {
      answer,
      status: 'DRAFTED',
      context: {
        attemptId: draftAttempt.attempt.id,
        autoSend: {
          eligible: autoSend.eligible,
          mode: automationMode,
          appliedConfidenceThreshold: autoSend.appliedConfidenceThreshold,
          reasons: autoSend.reasons,
        },
        requestedFacts: context.requestedFacts,
        matchedColor: context.matchedColor,
        matchedSize: context.matchedSize,
        matchingVariantCount: context.matchingVariants.length,
        source: guardedDraft.source,
        model: guardedDraft.model,
        interpretation: guardedDraft.interpretation,
        detectedFacts: guardedDraft.detectedFacts,
        answerability: guardedDraft.answerability,
        decision: replyDecision,
        confidence: guardedDraft.confidence,
        missingInformation: guardedDraft.missingInformation,
        usedEvidenceIds: guardedDraft.usedEvidenceIds,
        risks: guardedDraft.risks,
      },
    };
  }
}

function markInventoryAsUnverified(
  context: ProductAnswerContext,
): ProductAnswerContext {
  return {
    ...context,
    requestedFacts: [...new Set([...context.requestedFacts, 'STOCK' as const])],
    inventoryVerification: { status: 'UNAVAILABLE', checkedAt: null },
    inventoryFreshness: {
      ...context.inventoryFreshness,
      status: 'UNKNOWN',
      latestSyncedAt: null,
    },
    evidence: [
      ...context.evidence.filter((evidence) => evidence.id !== 'variant-stock'),
      {
        id: 'variant-stock',
        fact: 'STOCK',
        label: 'Canlı stok doğrulaması',
        value:
          'Pazaryerinden güncel stok bilgisi doğrulanamadı; ürün veya varyant mevcudiyeti bilinmiyor.',
        source: 'VARIANT',
        confidence: 0,
      },
    ],
  };
}

function applyVerifiedInventory(
  context: ProductAnswerContext,
  verification: InventoryVerificationResult,
): ProductAnswerContext {
  const analyzed = analyzeProductQuestion({
    questionId: context.questionId,
    question: context.question,
    providerKey: context.providerKey,
    product: { ...context.product, variants: verification.variants },
    additionalRequestedFacts: ['STOCK'],
  });
  return {
    ...analyzed,
    responsePreferences: context.responsePreferences,
    inventoryVerification: {
      status: 'VERIFIED',
      checkedAt: verification.checkedAt.toISOString(),
    },
    evidence: [
      ...analyzed.evidence,
      ...context.evidence.filter((item) =>
        ['STORE_KNOWLEDGE', 'CHANNEL_OVERRIDE', 'FAQ'].includes(item.source),
      ),
    ],
  };
}

function applyInventoryFreshnessGuard(
  draft: AiDraftResult,
  context: ProductAnswerContext,
): AiDraftResult {
  if (
    draft.answerability === 'OUT_OF_SCOPE' ||
    !context.requestedFacts.includes('STOCK') ||
    getUnlistedAvailabilitySize(context) ||
    (context.inventoryVerification?.status === 'VERIFIED' &&
      context.inventoryFreshness.status === 'FRESH')
  ) {
    return draft;
  }

  const missingInformation =
    context.inventoryFreshness.status === 'UNKNOWN'
      ? 'Pazaryerinden güncel stok bilgisi doğrulanamadı'
      : 'Stok bilgisi güncel bir senkronizasyonla doğrulanmalı';

  return {
    ...draft,
    decision: 'NEEDS_REVIEW',
    answerability:
      draft.answerability === 'FULL' ? 'PARTIAL' : draft.answerability,
    confidence: Math.min(draft.confidence, 0.6),
    missingInformation: [
      ...new Set([...draft.missingInformation, missingInformation]),
    ],
    risks: [...new Set([...draft.risks, 'STALE_INVENTORY' as const])],
  };
}
