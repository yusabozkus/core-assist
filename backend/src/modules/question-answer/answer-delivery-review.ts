import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import {
  AiDraftOutcome,
  AuditActorType,
  AuditOrigin,
  AuditResult,
  ProductQuestionStatus,
  QuestionAnswerStatus,
} from '../../generated/prisma/enums';
import type { AuditLogService } from '../audit/audit-log.service';

// Operator-only repair. Stop all answer workers before invoking this operation,
// then verify the marketplace outcome. It never sends an external answer.
export async function resolveAnswerDeliveryReview(
  prisma: PrismaService,
  audit: AuditLogService,
  input: {
    answerId: string;
    resolution: 'sent' | 'not-sent';
    note: string;
    operator: string;
  },
) {
  if (
    !input.note.trim() ||
    !input.operator.trim() ||
    !['sent', 'not-sent'].includes(input.resolution)
  ) {
    throw new Error(
      'A verified resolution, operator and evidence note are required.',
    );
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "question_answer" WHERE "id" = ${input.answerId} FOR UPDATE`;
    const delivery = await tx.questionAnswer.findUnique({
      where: { id: input.answerId },
      include: { store: { select: { workspaceId: true } } },
    });
    if (!delivery) throw new NotFoundException('Answer delivery not found.');
    if (delivery.status !== QuestionAnswerStatus.REVIEW_REQUIRED) {
      throw new ConflictException(
        'Only REVIEW_REQUIRED deliveries can be resolved.',
      );
    }
    const sent = input.resolution === 'sent';
    const status = sent
      ? QuestionAnswerStatus.SENT
      : QuestionAnswerStatus.FAILED;
    const verifiedAt = new Date();
    await tx.questionAnswer.update({
      where: { id: delivery.id },
      data: {
        status,
        processingStartedAt: null,
        // Actual delivery time is unknown; do not invent a marketplace timestamp.
        sentAt: null,
        lastError: sent
          ? null
          : 'Pazaryerinde gönderilmediği kontrol edildi. Tekrar gönderebilirsiniz.',
      },
    });
    if (sent) {
      await tx.productQuestion.update({
        where: { id: delivery.questionId },
        data: {
          status: ProductQuestionStatus.ANSWERED,
          answer: delivery.answer,
          answeredAt: null,
        },
      });
    }
    if (delivery.draftAttemptId) {
      await tx.aiDraftAttempt.update({
        where: { id: delivery.draftAttemptId },
        data: {
          outcome: sent ? AiDraftOutcome.SENT : AiDraftOutcome.AVAILABLE,
          finalizedAt: sent ? verifiedAt : null,
          ...(!sent ? { selectedAt: null, autoSendEligible: false } : {}),
        },
      });
    }
    await audit.record(
      {
        actorType: AuditActorType.SYSTEM,
        actorName: input.operator,
        origin: AuditOrigin.WORKER,
        action: 'QUESTION_ANSWER_DELIVERY_REVIEWED',
        result: AuditResult.SUCCESS,
        workspaceId: delivery.store.workspaceId,
        storeId: delivery.storeId,
        targetType: 'PRODUCT_QUESTION',
        targetId: delivery.questionId,
        before: { status: delivery.status },
        after: { status },
        metadata: {
          answerId: delivery.id,
          resolution: input.resolution,
          evidence: input.note,
          verifiedAt: verifiedAt.toISOString(),
        },
      },
      tx,
    );
    return { id: delivery.id, status };
  });
}
