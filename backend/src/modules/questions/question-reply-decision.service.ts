import { Injectable } from '@nestjs/common';
import {
  OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD,
  type AiDraftResult,
} from '../ai/ai-draft.types';
import type { QuestionReplyDecision } from './product-answer-context.types';

export const MINIMUM_READY_CONFIDENCE = 0.85;

@Injectable()
export class QuestionReplyDecisionService {
  evaluate(
    draft: AiDraftResult,
  ): Exclude<QuestionReplyDecision, 'DO_NOT_REPLY'> {
    if (draft.answerability === 'OUT_OF_SCOPE') {
      return draft.decision === 'DRAFT' &&
        draft.confidence >= OUT_OF_SCOPE_CLASSIFICATION_THRESHOLD
        ? 'READY_FOR_SEND'
        : 'NEEDS_REVIEW';
    }

    if (
      draft.decision === 'NEEDS_REVIEW' ||
      draft.answerability !== 'FULL' ||
      draft.confidence < MINIMUM_READY_CONFIDENCE ||
      draft.risks.length > 0 ||
      draft.missingInformation.length > 0 ||
      draft.usedEvidenceIds.length === 0
    ) {
      return 'NEEDS_REVIEW';
    }

    return 'READY_FOR_SEND';
  }
}
