import { Inject, Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  NotificationSeverity,
  NotificationType,
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
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

@Injectable()
export class QuestionDraftWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drafts: QuestionDraftService,
    @Inject(QUESTION_ANSWER_DISPATCHER)
    private readonly answers: QuestionAnswerDispatcher,
    private readonly notifications: NotificationsService,
  ) {}

  async run(data: QuestionDraftJobData) {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: data.questionId, storeId: data.storeId },
      select: {
        status: true,
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
            knowledgeProfile: { select: { automationMode: true } },
          },
        },
      },
    });

    if (!question) {
      return { status: 'SKIPPED' as const };
    }

    const automationMode = question.store.knowledgeProfile?.automationMode;
    if (
      automationMode !== AiAutomationMode.SHADOW &&
      automationMode !== AiAutomationMode.SAFE_AUTO
    ) {
      await this.clearProcessingState(data);
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
        await this.clearProcessingState(data);
        return { status: 'QUEUED' as const };
      }

      await this.clearProcessingState(data);
      return { status: 'SKIPPED' as const };
    }

    if (question.status !== ProductQuestionStatus.PENDING) {
      await this.clearProcessingState(data);
      return { status: 'SKIPPED' as const };
    }

    await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        status: ProductQuestionStatus.PENDING,
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
        draftProcessingStartedAt: new Date(),
      },
    });

    const result = await this.drafts.generate(data.storeId, data.questionId, {
      trigger: 'AUTOMATION',
    });

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

  async markFinalFailure(data: QuestionDraftJobData, error: unknown) {
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
        draftProcessingStatus: {
          in: [
            QuestionDraftProcessingStatus.QUEUED,
            QuestionDraftProcessingStatus.PROCESSING,
          ],
        },
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

  private async clearProcessingState(data: QuestionDraftJobData) {
    await this.prisma.productQuestion.updateMany({
      where: {
        id: data.questionId,
        storeId: data.storeId,
        draftProcessingStatus: { not: null },
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
