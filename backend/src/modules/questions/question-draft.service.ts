import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProductQuestionStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  AiDraftGenerator,
  AiDraftRateLimitError,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import { ProductAnswerContextService } from './product-answer-context.service';
import type { DraftQuestionAnswer } from './product-answer-context.types';

@Injectable()
export class QuestionDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productContext: ProductAnswerContextService,
    private readonly aiDrafts: AiDraftGenerator,
  ) {}

  async generate(
    storeId: string,
    questionId: string,
  ): Promise<DraftQuestionAnswer> {
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
        decision: aiDraft.decision,
        confidence: aiDraft.confidence,
        missingInformation: aiDraft.missingInformation,
        usedEvidenceIds: aiDraft.usedEvidenceIds,
        risks: aiDraft.risks,
      },
    };
  }
}
