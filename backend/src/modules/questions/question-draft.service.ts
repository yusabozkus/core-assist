import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ProductQuestionStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  AiDraftGenerator,
  AiDraftRateLimitError,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import { ProductAnswerContextService } from './product-answer-context.service';
import type { DraftQuestionAnswer } from './product-answer-context.types';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';

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
  ): Promise<DraftQuestionAnswer> {
    const policyQuestion = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        question: true,
        status: true,
        answerDelivery: { select: { id: true } },
      },
    });

    if (!policyQuestion) {
      throw new NotFoundException('Ürün sorusu bulunamadı.');
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

    const answer = aiDraft.answer;
    const replyDecision = this.replyDecision.evaluate(aiDraft);
    const draftedAt = new Date();
    const updated = await this.prisma.productQuestion.updateMany({
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
        draftConfidence: aiDraft.confidence,
        draftAnswerability: aiDraft.answerability,
        draftRisks: aiDraft.risks,
        draftMissingInformation: aiDraft.missingInformation,
        draftEvidenceIds: aiDraft.usedEvidenceIds,
        draftModel: aiDraft.model,
        draftedAt,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Taslak oluşturulurken soru durumu değişti.');
    }

    return {
      answer,
      status: 'DRAFTED',
      context: {
        requestedFacts: context.requestedFacts,
        matchedColor: context.matchedColor,
        matchedSize: context.matchedSize,
        matchingVariantCount: context.matchingVariants.length,
        source: aiDraft.source,
        model: aiDraft.model,
        interpretation: aiDraft.interpretation,
        detectedFacts: aiDraft.detectedFacts,
        answerability: aiDraft.answerability,
        decision: replyDecision,
        confidence: aiDraft.confidence,
        missingInformation: aiDraft.missingInformation,
        usedEvidenceIds: aiDraft.usedEvidenceIds,
        risks: aiDraft.risks,
      },
    };
  }
}
