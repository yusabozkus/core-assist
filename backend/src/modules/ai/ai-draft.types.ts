import type {
  ProductAnswerContext,
  ProductAnswerFact,
  ProductAnswerRisk,
} from '../questions/product-answer-context.types';

export type AiDraftDecision = 'DRAFT' | 'NEEDS_REVIEW';
export type AiDraftSource = 'GEMINI';
export type AiDraftScope = 'IN_SCOPE' | 'OUT_OF_SCOPE';
export type AiDraftAnswerability =
  'FULL' | 'PARTIAL' | 'INSUFFICIENT' | 'OUT_OF_SCOPE';

export const OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD = 0.9;

export type AiDraftResult = {
  answer: string;
  interpretation: string;
  scope: AiDraftScope;
  detectedFacts: ProductAnswerFact[];
  answerability: AiDraftAnswerability;
  decision: AiDraftDecision;
  confidence: number;
  usedFacts: ProductAnswerFact[];
  usedEvidenceIds: string[];
  missingInformation: string[];
  risks: ProductAnswerRisk[];
  source: AiDraftSource;
  model: string;
};

export type GeminiDraftPayload = Pick<
  AiDraftResult,
  | 'answer'
  | 'interpretation'
  | 'scope'
  | 'detectedFacts'
  | 'answerability'
  | 'decision'
  | 'confidence'
  | 'usedEvidenceIds'
  | 'missingInformation'
> & { estimatedSize?: string };

export type GeminiGenerationRequest = {
  model: string;
  prompt: string;
  thinkingLevel: 'minimal' | 'low' | 'medium';
  allowedEstimatedSizes?: string[];
};

export class AiDraftRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number | null) {
    super('AI draft rate limit exceeded.');
    this.name = 'AiDraftRateLimitError';
  }
}

export abstract class AiDraftGenerator {
  abstract generate(
    context: ProductAnswerContext,
  ): Promise<AiDraftResult | null>;
}
