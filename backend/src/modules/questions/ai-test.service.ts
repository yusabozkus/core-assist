import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiDraftGenerator, AiDraftRateLimitError } from '../ai/ai-draft.types';
import {
  evaluateAutoSendEligibility,
  DEFAULT_AUTO_SEND_CONFIDENCE,
} from './ai-auto-send-policy';
import { ProductAnswerContextService } from './product-answer-context.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import {
  applyInventoryFreshnessGuard,
  markInventoryAsUnverified,
} from './question-draft.service';
import { getUnlistedAvailabilitySize } from './unlisted-size-availability';
import type { AiTestQuestionDto } from './dto/ai-test-question.dto';

@Injectable()
export class AiTestService {
  private readonly activeUsers = new Set<string>();

  constructor(
    private readonly contexts: ProductAnswerContextService,
    private readonly drafts: AiDraftGenerator,
    private readonly replyDecisions: QuestionReplyDecisionService,
    private readonly responsePolicy: QuestionResponsePolicyService,
  ) {}

  async answer(storeId: string, userId: string, input: AiTestQuestionDto) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.AI_TEST_ENABLED !== 'true'
    ) {
      throw new NotFoundException();
    }

    const activeKey = `${storeId}:${userId}`;
    if (this.activeUsers.has(activeKey)) {
      throw new HttpException(
        'Önceki test yanıtının tamamlanmasını bekleyin.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeUsers.add(activeKey);

    try {
      let context = await this.contexts.buildPreview(
        storeId,
        userId,
        input.productId,
        input.question,
        input.providerKey,
      );
      const responsePolicy = this.responsePolicy.evaluate(input.question);
      if (responsePolicy.action === 'DO_NOT_REPLY') {
        return {
          answer: null,
          decision: 'DO_NOT_REPLY' as const,
          policyReason: responsePolicy.reason,
          providerKey: context.providerKey,
        };
      }

      if (
        context.requestedFacts.includes('STOCK') &&
        !getUnlistedAvailabilitySize(context)
      ) {
        context = markInventoryAsUnverified(context);
      }

      let draft = await this.drafts.generate(context);
      if (
        draft &&
        context.inventoryVerification?.status !== 'UNAVAILABLE' &&
        !getUnlistedAvailabilitySize(context) &&
        (draft.detectedFacts.includes('STOCK') ||
          draft.usedFacts.includes('STOCK') ||
          draft.usedEvidenceIds.includes('variant-stock'))
      ) {
        context = markInventoryAsUnverified(context);
        draft = await this.drafts.generate(context);
      }
      if (!draft) {
        throw new ServiceUnavailableException(
          'AI yanıtı şu anda oluşturulamadı. Lütfen tekrar deneyin.',
        );
      }

      const guardedDraft = applyInventoryFreshnessGuard(draft, context);
      const decision = this.replyDecisions.evaluate(guardedDraft);
      const autoSend = evaluateAutoSendEligibility({
        draft: guardedDraft,
        decision,
        requestedFacts: context.requestedFacts,
        storeMinimumConfidence:
          context.responsePreferences?.minimumAutoSendConfidence ??
          DEFAULT_AUTO_SEND_CONFIDENCE,
        allowHeightWeightRecommendation:
          context.heightWeightSizeRecommendation?.status ===
            'ESTIMATE_ALLOWED' ||
          context.heightWeightSizeRecommendation?.status === 'MATCHED',
      });

      return {
        answer: guardedDraft.answer,
        decision,
        providerKey: context.providerKey,
        requestedFacts: context.requestedFacts,
        detectedFacts: guardedDraft.detectedFacts,
        answerability: guardedDraft.answerability,
        confidence: guardedDraft.confidence,
        interpretation: guardedDraft.interpretation,
        missingInformation: guardedDraft.missingInformation,
        risks: guardedDraft.risks,
        evidence: context.evidence
          .filter((item) => guardedDraft.usedEvidenceIds.includes(item.id))
          .map(({ id, label, value, source }) => ({
            id,
            label,
            value,
            source,
          })),
        model: guardedDraft.model,
        automationMode: context.responsePreferences?.automationMode ?? 'OFF',
        autoSend: {
          ...autoSend,
          wouldAutoSend:
            context.responsePreferences?.automationMode === 'SAFE_AUTO' &&
            autoSend.eligible,
        },
        previewOnly: true,
      };
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
    } finally {
      this.activeUsers.delete(activeKey);
    }
  }
}
