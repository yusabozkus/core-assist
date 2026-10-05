import type { Prisma } from '../../generated/prisma/client';
import {
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';

// Share the current review definition with the inbox and analytics. Historical
// draft decisions do not tell us whether a question still needs attention.
export function reviewRequiredQuestionWhere(): Prisma.ProductQuestionWhereInput {
  return {
    status: ProductQuestionStatus.DRAFTED,
    draftDecision: QuestionReplyDecision.NEEDS_REVIEW,
    draftProcessingStatus: null,
    OR: [
      { answerDelivery: { is: null } },
      { answerDelivery: { is: { status: QuestionAnswerStatus.FAILED } } },
    ],
  };
}
