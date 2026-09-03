import type { PrismaService } from '../../database/prisma.service';
import type { AiDraftResult } from '../ai/ai-draft.types';
import type { ProductAnswerContextService } from './product-answer-context.service';
import { QuestionDraftService } from './question-draft.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';

describe('QuestionDraftService', () => {
  it('persists the deterministic reply decision with the draft', async () => {
    let savedData: Record<string, unknown> | undefined;
    const updateMany = jest.fn((input: { data: Record<string, unknown> }) => {
      savedData = input.data;
      return Promise.resolve({ count: 1 });
    });
    const productQuestion = {
      findFirst: jest.fn().mockResolvedValue({
        question: 'Ürün regular kalıp mı?',
        status: 'PENDING',
        answerDelivery: null,
      }),
      updateMany,
    };
    const context = {
      build: jest.fn().mockResolvedValue({
        questionId: 'question-1',
        requestedFacts: ['FIT'],
        matchedColor: null,
        matchedSize: null,
        matchingVariants: [],
      }),
    };
    const aiDrafts = {
      generate: jest.fn().mockResolvedValue(createDraft()),
    };
    const service = new QuestionDraftService(
      { productQuestion } as unknown as PrismaService,
      context as unknown as ProductAnswerContextService,
      aiDrafts,
      new QuestionResponsePolicyService(),
      new QuestionReplyDecisionService(),
    );

    const result = await service.generate('store-1', 'question-1');

    expect(result).toMatchObject({
      status: 'DRAFTED',
      context: {
        decision: 'READY_FOR_SEND',
        confidence: 0.95,
      },
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(savedData).toMatchObject({
      answer: 'Merhabalar, ürün regular kalıptır.',
      status: 'DRAFTED',
      draftDecision: 'READY_FOR_SEND',
      draftConfidence: 0.95,
      draftAnswerability: 'FULL',
      draftRisks: [],
      draftMissingInformation: [],
      draftEvidenceIds: ['attribute-fit'],
      draftModel: 'gemini-3.5-flash-lite',
    });
    expect(savedData?.draftedAt).toBeInstanceOf(Date);
  });
});

function createDraft(): AiDraftResult {
  return {
    answer: 'Merhabalar, ürün regular kalıptır.',
    interpretation: 'Kalıp bilgisi soruluyor.',
    detectedFacts: ['FIT'],
    answerability: 'FULL',
    decision: 'DRAFT',
    confidence: 0.95,
    usedFacts: ['FIT'],
    usedEvidenceIds: ['attribute-fit'],
    missingInformation: [],
    risks: [],
    source: 'GEMINI',
    model: 'gemini-3.5-flash-lite',
  };
}
