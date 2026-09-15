import {
  OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import type {
  ProductAnswerFact,
  QuestionReplyDecision,
} from './product-answer-context.types';

export const DEFAULT_AUTO_SEND_CONFIDENCE = 0.85;

const INTENT_CONFIDENCE_FLOORS: Record<ProductAnswerFact, number> = {
  STOCK: 0.97,
  PRICE: 0.97,
  MATERIAL: 0.93,
  DURABILITY: 0.98,
  SHIPPING: 0.97,
  RETURN: 0.97,
  EXCHANGE: 0.97,
  WARRANTY: 0.98,
  SIZE: 0.98,
  COLOR: 0.9,
  FIT: 0.93,
  CARE: 0.92,
  PRODUCT_CODE: 0.9,
  PRODUCT_INFO: 0.94,
};

export type AutoSendEligibilityReason =
  | 'REVIEW_REQUIRED'
  | 'PARTIAL_ANSWER'
  | 'LOW_CONFIDENCE'
  | 'MISSING_EVIDENCE'
  | 'MISSING_INFORMATION'
  | 'RISK_DETECTED';

export function evaluateAutoSendEligibility({
  draft,
  decision,
  requestedFacts,
  storeMinimumConfidence,
}: {
  draft: AiDraftResult;
  decision: Exclude<QuestionReplyDecision, 'DO_NOT_REPLY'>;
  requestedFacts: ProductAnswerFact[];
  storeMinimumConfidence: number;
}) {
  if (draft.answerability === 'OUT_OF_SCOPE') {
    const eligible =
      decision === 'READY_FOR_SEND' &&
      draft.confidence >= OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD;

    return {
      eligible,
      appliedConfidenceThreshold: OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD,
      reasons: eligible
        ? []
        : (['REVIEW_REQUIRED'] satisfies AutoSendEligibilityReason[]),
    };
  }

  const normalizedStoreMinimum = Math.min(
    Math.max(storeMinimumConfidence, DEFAULT_AUTO_SEND_CONFIDENCE),
    0.99,
  );
  const intentThreshold = requestedFacts.reduce(
    (highest, fact) => Math.max(highest, INTENT_CONFIDENCE_FLOORS[fact]),
    DEFAULT_AUTO_SEND_CONFIDENCE,
  );
  const appliedConfidenceThreshold = Math.max(
    normalizedStoreMinimum,
    intentThreshold,
  );
  const reasons: AutoSendEligibilityReason[] = [];

  if (decision !== 'READY_FOR_SEND') reasons.push('REVIEW_REQUIRED');
  if (draft.answerability !== 'FULL') reasons.push('PARTIAL_ANSWER');
  if (draft.confidence < appliedConfidenceThreshold) {
    reasons.push('LOW_CONFIDENCE');
  }
  if (draft.usedEvidenceIds.length === 0) reasons.push('MISSING_EVIDENCE');
  if (draft.missingInformation.length > 0) {
    reasons.push('MISSING_INFORMATION');
  }
  if (draft.risks.length > 0) reasons.push('RISK_DETECTED');

  return {
    eligible: reasons.length === 0,
    appliedConfidenceThreshold,
    reasons: [...new Set(reasons)],
  };
}

export function getIntentConfidenceFloor(fact: ProductAnswerFact) {
  return INTENT_CONFIDENCE_FLOORS[fact];
}
