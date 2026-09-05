import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
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
import {
  AiDraftGenerator,
  AiDraftRateLimitError,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import { ProductAnswerContextService } from './product-answer-context.service';
import type {
  DraftQuestionAnswer,
  ProductAnswerContext,
} from './product-answer-context.types';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import {
  DEFAULT_AUTO_SEND_CONFIDENCE,
  evaluateAutoSendEligibility,
} from './ai-auto-send-policy';

type GenerateDraftOptions = {
  trigger?: 'MANUAL' | 'AUTOMATION';
  requestedByUserId?: string;
};

@Injectable()
export class QuestionDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productContext: ProductAnswerContextService,
    private readonly aiDrafts: AiDraftGenerator,
    private readonly responsePolicy: QuestionResponsePolicyService,
    private readonly replyDecision: QuestionReplyDecisionService,
  ) {}

  async generate(
    storeId: string,
    questionId: string,
    options: GenerateDraftOptions = {},
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
      policyQuestion.answerDelivery?.status === QuestionAnswerStatus.SENT
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

    const context = await this.productContext.build(storeId, questionId);
    let aiDraft: AiDraftResult | null;

    try {
      aiDraft = await this.aiDrafts.generate(context);
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
    });
    const draftedAt = new Date();
    const draftAttempt = await this.prisma.$transaction(async (transaction) => {
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

      return attempt;
    });

    return {
      answer,
      status: 'DRAFTED',
      context: {
        attemptId: draftAttempt.id,
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

function applyInventoryFreshnessGuard(
  draft: AiDraftResult,
  context: ProductAnswerContext,
): AiDraftResult {
  if (
    !context.requestedFacts.includes('STOCK') ||
    context.inventoryFreshness.status === 'FRESH'
  ) {
    return draft;
  }

  const missingInformation =
    context.inventoryFreshness.status === 'UNKNOWN'
      ? 'Stok verisinin son kontrol zamanı bilinmiyor'
      : 'Stok bilgisi güncel bir senkronizasyonla doğrulanmalı';

  return {
    ...draft,
    decision: 'NEEDS_REVIEW',
    confidence: Math.min(draft.confidence, 0.6),
    missingInformation: [
      ...new Set([...draft.missingInformation, missingInformation]),
    ],
    risks: [...new Set([...draft.risks, 'STALE_INVENTORY' as const])],
  };
}
