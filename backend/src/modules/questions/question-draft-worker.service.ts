import { Inject, Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  NotificationSeverity,
  NotificationType,
  OperationalEmailIncidentKind,
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import { QUESTION_ANSWER_DISPATCHER } from '../question-answer/question-answer.constants';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import { NotificationsService } from '../notifications/notifications.service';
import { QuestionDraftService } from './question-draft.service';
import type { QuestionDraftJobData } from './question-draft.types';
import type { DraftQuestionAnswer } from './product-answer-context.types';
import { DraftStoreInactiveException } from './draft-execution.service';

export type DraftWorkerAttempt = {
  startedAt: Date | null;
  queuedAt: Date | null;
};
type ProcessingSnapshot = {
  draftProcessingStatus: QuestionDraftProcessingStatus | null;
  draftProcessingStartedAt: Date | null;
  draftQueuedAt: Date | null;
};

@Injectable()
export class QuestionDraftWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drafts: QuestionDraftService,
    @Inject(QUESTION_ANSWER_DISPATCHER)
    private readonly answers: QuestionAnswerDispatcher,
    private readonly notifications: NotificationsService,
  ) {}

  async run(data: QuestionDraftJobData, attempt: DraftWorkerAttempt) {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: data.questionId, storeId: data.storeId },
      select: {
        status: true,
        draftProcessingStatus: true,
        draftProcessingStartedAt: true,
        draftQueuedAt: true,
        answer: true,
        draftDecision: true,
        draftAttempts: {
          orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
          take: 1,
          select: { id: true, autoSendEligible: true },
        },
        answerDelivery: { select: { status: true } },
        store: {
          select: {
            status: true,
            knowledgeProfile: { select: { automationMode: true } },
          },
        },
      },
    });

    if (!question) {
      return { status: 'SKIPPED' as const };
    }
    if (question.store.status !== StoreStatus.ACTIVE) {
      await this.clearProcessingState(data, question, true);
      return { status: 'SKIPPED' as const };
    }

    const automationMode = question.store.knowledgeProfile?.automationMode;
    const knowledgeResolved = data.reason === 'KNOWLEDGE_RESOLVED';
    if (
      !knowledgeResolved &&
      automationMode !== AiAutomationMode.SHADOW &&
      automationMode !== AiAutomationMode.SAFE_AUTO
    ) {
      await this.clearProcessingState(data, question);
      return { status: 'SKIPPED' as const };
    }

    if (question.status === ProductQuestionStatus.DRAFTED) {
      const deliveryCanBeQueued =
        !question.answerDelivery ||
        question.answerDelivery.status === QuestionAnswerStatus.FAILED;

      if (
        automationMode === AiAutomationMode.SAFE_AUTO &&
        question.draftDecision === QuestionReplyDecision.READY_FOR_SEND &&
        question.answer &&
        question.draftAttempts[0] &&
        question.draftAttempts[0].autoSendEligible &&
        deliveryCanBeQueued
      ) {
        await this.enqueueAutomaticAnswer(
          data.storeId,
          data.questionId,
          question.answer,
          question.draftAttempts[0].id,
        );
        await this.clearProcessingState(data, question);
        return { status: 'QUEUED' as const };
      }

      await this.clearProcessingState(data, question);
      return { status: 'SKIPPED' as const };
    }

    if (question.status !== ProductQuestionStatus.PENDING) {
      await this.clearProcessingState(data, question);
      return { status: 'SKIPPED' as const };
    }

    const startedAt = new Date();
    const claimed = await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        status: ProductQuestionStatus.PENDING,
        store: { status: StoreStatus.ACTIVE },
        draftQueuedAt: question.draftQueuedAt,
        draftProcessingStartedAt: question.draftProcessingStartedAt,
        draftProcessingStatus: {
          in: [
            QuestionDraftProcessingStatus.QUEUED,
            QuestionDraftProcessingStatus.PROCESSING,
          ],
        },
      },
      data: {
        draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
        draftProcessingError: null,
        draftProcessingStartedAt: startedAt,
      },
    });
    if (!claimed.count) {
      await this.clearProcessingState(data, question, true);
      return { status: 'SKIPPED' as const };
    }
    attempt.startedAt = startedAt;
    attempt.queuedAt = question.draftQueuedAt;

    let result: DraftQuestionAnswer;
    try {
      result = await this.drafts.generate(data.storeId, data.questionId, {
        trigger: knowledgeResolved ? 'MANUAL' : 'AUTOMATION',
        requestedByUserId: data.requestedByUserId,
      });
    } catch (error) {
      if (!(error instanceof DraftStoreInactiveException)) throw error;
      await this.clearInactiveAttempt(data, attempt);
      return { status: 'SKIPPED' as const };
    }

    if (result.status === 'DRAFTED') {
      await this.notifications.recordOperationalSuccess({
        storeId: data.storeId,
        kind: OperationalEmailIncidentKind.AI_DRAFT,
      });
      await this.notifications.resolveOperationalWarning({
        storeId: data.storeId,
        kind: OperationalEmailIncidentKind.AI_QUOTA_PAUSED,
      });
      await this.notifications.resolveOperationalWarning({
        storeId: data.storeId,
        kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
      });
    }

    if (
      result.status === 'DRAFTED' &&
      result.context.decision === 'NEEDS_REVIEW'
    ) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.AI_REVIEW_REQUIRED,
        severity: NotificationSeverity.WARNING,
        title: 'Yanıt incelemeniz gerekiyor',
        message:
          'AI bu soru için güvenli bir otomatik gönderim kararı veremedi. Hazırlanan taslağı inceleyin.',
        actionUrl: `/dashboard/inbox?question=${data.questionId}`,
        entityType: 'PRODUCT_QUESTION',
        entityId: data.questionId,
        dedupeKey: `ai-review-required:${data.questionId}`,
      });
    }

    if (
      automationMode !== AiAutomationMode.SAFE_AUTO ||
      result.status !== 'DRAFTED' ||
      result.context.decision !== 'READY_FOR_SEND' ||
      !result.context.autoSend.eligible
    ) {
      return { status: result.status };
    }

    await this.enqueueAutomaticAnswer(
      data.storeId,
      data.questionId,
      result.answer,
      result.context.attemptId,
    );

    return { status: 'QUEUED' as const };
  }

  async markFinalFailure(
    data: QuestionDraftJobData,
    error: unknown,
    attempt: DraftWorkerAttempt,
  ) {
    if (!attempt.startedAt) return;
    const message =
      error instanceof Error ? error.message : 'AI taslağı oluşturulamadı.';
    const billingBlocked =
      error instanceof BillingAccessRequiredException ||
      error instanceof BillingQuotaExceededException;

    const updated = await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        status: ProductQuestionStatus.PENDING,
        store: { status: StoreStatus.ACTIVE },
        draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
        draftProcessingStartedAt: attempt.startedAt,
        draftQueuedAt: attempt.queuedAt,
      },
      data: {
        draftProcessingStatus:
          error instanceof BillingQuotaExceededException
            ? QuestionDraftProcessingStatus.BLOCKED_QUOTA
            : error instanceof BillingAccessRequiredException
              ? QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION
              : QuestionDraftProcessingStatus.FAILED,
        draftProcessingError: message.slice(0, 1_000),
        draftProcessingStartedAt: null,
      },
    });

    if (!updated.count) {
      await this.clearInactiveAttempt(data, attempt);
    }
    if (updated.count > 0 && billingBlocked) {
      const quotaBlocked = error instanceof BillingQuotaExceededException;
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.AI_AUTOMATION_PAUSED,
        severity: NotificationSeverity.WARNING,
        title: 'AI otomasyonu durduruldu',
        message: quotaBlocked
          ? 'Aylık AI soru hakkı dolduğu için yeni otomatik taslaklar hazırlanmıyor.'
          : 'Aktif abonelik bulunmadığı için yeni otomatik taslaklar hazırlanmıyor.',
        actionUrl: '/billing',
        entityType: 'STORE',
        entityId: data.storeId,
        dedupeKey: `ai-automation-paused:${data.storeId}:${quotaBlocked ? 'quota' : 'billing'}`,
      });
      await this.notifications.recordOperationalFailure({
        storeId: data.storeId,
        kind: quotaBlocked
          ? OperationalEmailIncidentKind.AI_QUOTA_PAUSED
          : OperationalEmailIncidentKind.AI_BILLING_PAUSED,
      });
    } else if (updated.count > 0) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.AI_DRAFT_FAILED,
        severity: NotificationSeverity.ERROR,
        title: 'AI taslağı oluşturulamadı',
        message:
          'Ürün sorusu için taslak hazırlanamadı. Soruyu inceleyip taslağı yeniden oluşturabilirsiniz.',
        actionUrl: `/dashboard/inbox?question=${data.questionId}`,
        entityType: 'PRODUCT_QUESTION',
        entityId: data.questionId,
        dedupeKey: `ai-draft-failed:${data.questionId}`,
      });
      await this.notifications.recordOperationalFailure({
        storeId: data.storeId,
        kind: OperationalEmailIncidentKind.AI_DRAFT,
      });
    }
  }

  private async enqueueAutomaticAnswer(
    storeId: string,
    questionId: string,
    answer: string,
    draftAttemptId: string,
  ) {
    await this.answers.enqueue({
      storeId,
      questionId,
      origin: 'AUTOMATION',
      answer,
      draftAttemptId,
    });
  }

  async deferForCapacity(
    data: QuestionDraftJobData,
    attempt: DraftWorkerAttempt,
  ) {
    if (!attempt.startedAt) return;
    const updated = await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        status: ProductQuestionStatus.PENDING,
        store: { status: StoreStatus.ACTIVE },
        draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
        draftProcessingStartedAt: attempt.startedAt,
        draftQueuedAt: attempt.queuedAt,
      },
      data: {
        draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
        draftProcessingStartedAt: null,
      },
    });
    if (!updated.count) {
      await this.clearInactiveAttempt(data, attempt);
    }
  }

  private async clearInactiveAttempt(
    data: QuestionDraftJobData,
    attempt: DraftWorkerAttempt,
  ) {
    return this.clearProcessingState(
      data,
      {
        draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
        draftProcessingStartedAt: attempt.startedAt,
        draftQueuedAt: attempt.queuedAt,
      },
      true,
    );
  }

  private async clearProcessingState(
    data: QuestionDraftJobData,
    snapshot: ProcessingSnapshot,
    inactiveStoreOnly = false,
  ) {
    await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        ...(inactiveStoreOnly
          ? { store: { status: { not: StoreStatus.ACTIVE } } }
          : {}),
        draftProcessingStatus: snapshot.draftProcessingStatus,
        draftProcessingStartedAt: snapshot.draftProcessingStartedAt,
        draftQueuedAt: snapshot.draftQueuedAt,
      },
      data: {
        draftProcessingStatus: null,
        draftProcessingError: null,
        draftQueuedAt: null,
        draftProcessingStartedAt: null,
      },
    });
  }
}
