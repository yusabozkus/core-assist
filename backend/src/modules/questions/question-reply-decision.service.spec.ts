import type { AiDraftResult } from '../ai/ai-draft.types';
import { QuestionReplyDecisionService } from './question-reply-decision.service';

describe('QuestionReplyDecisionService', () => {
  const service = new QuestionReplyDecisionService();

  it('marks a fully supported high-confidence answer as ready', () => {
    expect(service.evaluate(createDraft())).toBe('READY_FOR_SEND');
  });

  it.each([
    ['model review decision', { decision: 'NEEDS_REVIEW' as const }],
    ['partial answer', { answerability: 'PARTIAL' as const }],
    ['low confidence', { confidence: 0.84 }],
    ['detected risk', { risks: ['UNSUPPORTED_CLAIM'] as const }],
    ['missing information', { missingInformation: ['Kumaş bilgisi'] }],
    ['missing evidence', { usedEvidenceIds: [] }],
  ])('requires review for %s', (_label, overrides) => {
    expect(service.evaluate(createDraft(overrides))).toBe('NEEDS_REVIEW');
  });
});

function createDraft(overrides: Partial<AiDraftResult> = {}): AiDraftResult {
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
    ...overrides,
  };
}
