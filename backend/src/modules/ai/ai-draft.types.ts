import type {
  ProductAnswerContext,
  ProductAnswerFact,
} from '../questions/product-answer-context.types';

export type AiDraftDecision = 'DRAFT' | 'NEEDS_REVIEW';
export type AiDraftSource = 'GEMINI_FAST' | 'GEMINI_SMART';

export type AiDraftResult = {
  answer: string;
  decision: AiDraftDecision;
  confidence: number;
  usedFacts: ProductAnswerFact[];
  missingInformation: string[];
  source: AiDraftSource;
  model: string;
};

export type GeminiDraftPayload = Omit<AiDraftResult, 'source' | 'model'>;

export type GeminiGenerationRequest = {
  model: string;
  prompt: string;
  thinkingLevel: 'minimal' | 'low' | 'medium';
};

export abstract class AiDraftGenerator {
  abstract generate(
    context: ProductAnswerContext,
  ): Promise<AiDraftResult | null>;
}
