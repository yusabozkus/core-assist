import { Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  NotificationSeverity,
  NotificationType,
  OperationalEmailIncidentKind,
  ProductQuestionStatus,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
  StoreStatus,
  SyncEmailIncidentKind,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditLogService,
  AuditActorType,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-actions';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import { BILLING_AUTOMATION_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { isProviderAuthenticationError } from '../channels/providers/connector-utils';
import { InventoryVerificationService } from '../inventory-verification/inventory-verification.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { QuestionAnswerJobData } from './question-answer.types';
import { requiresInventoryVerification } from './automatic-answer-inventory.guard';

@Injectable()
export class QuestionAnswerWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    private readonly inventoryVerification: InventoryVerificationService,
    private readonly notifications: NotificationsService,
    private readonly billing: BillingSubscriptionService,
    private readonly audit: AuditLogService,
  ) {}

  async run(data: QuestionAnswerJobData) {
    const delivery = await this.prisma.questionAnswer.findFirst({
      where: { id: data.answerId, storeId: data.storeId },
      select: {
        id: true,
        connectionId: true,
        answer: true,
        origin: true,
        requestedByUserId: true,
        status: true,
        questionId: true,
        draftAttemptId: true,
        question: {
          select: {
            externalQuestionId: true,
            productId: true,
            answer: true,
            draftDecision: true,
            draftRisks: true,
            draftMissingInformation: true,
            draftEvidenceIds: true,
            draftAttempts: {
              orderBy: [
                { createdAt: 'desc' as const },
                { id: 'desc' as const },
              ],
              take: 1,
              select: {
                id: true,
                autoSendEligible: true,
                answerability: true,
                inventorySnapshotHash: true,
                requestedFacts: true,
                detectedFacts: true,
              },
            },
            store: {
              select: {
                workspaceId: true,
                knowledgeProfile: { select: { automationMode: true } },
              },
            },
          },
        },
        connection: {
          select: {
            providerKey: true,
            environment: true,
            status: true,
            credentialsEncrypted: true,
          },
        },
      },
    });

    if (!delivery) throw new Error('Question answer delivery is unavailable.');
    if (
      delivery.status === QuestionAnswerStatus.SENT ||
      delivery.status === QuestionAnswerStatus.FAILED
    )
      return;

    const stopIfSubscriptionInactive = async () => {
      if (
        delivery.origin !== QuestionAnswerOrigin.AUTOMATION ||
        (await this.billing.hasStoreAccess(data.storeId))
      )
        return false;
      await this.rejectAutomaticDelivery(
        data,
        delivery.questionId,
        delivery.draftAttemptId,
        BILLING_AUTOMATION_STOPPED_MESSAGE,
        false,
        true,
      );
      return true;
    };
    if (await stopIfSubscriptionInactive()) return;

    const claimed = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "store"
        WHERE "id" = ${data.storeId}
        FOR UPDATE
      `;

      const store = await transaction.store.findUnique({
        where: { id: data.storeId },
        select: { status: true },
      });
      if (store?.status !== StoreStatus.ACTIVE) return false;

      const updated = await transaction.questionAnswer.updateMany({
        where: {
          id: delivery.id,
          storeId: data.storeId,
          status: {
            in: [QuestionAnswerStatus.QUEUED, QuestionAnswerStatus.PROCESSING],
          },
        },
        data: {
          status: QuestionAnswerStatus.PROCESSING,
          attempts: { increment: 1 },
          processingStartedAt: new Date(),
          lastError: null,
        },
      });

      return updated.count === 1;
    });

    if (!claimed) {
      await this.failPendingDelivery(
        data,
        'Mağaza aktif olmadığı için cevap gönderilmedi.',
      );
      return;
    }

    if (delivery.connection.status !== ChannelConnectionStatus.CONNECTED) {
      throw new Error('Question channel connection is not active.');
    }
    if (!delivery.connection.credentialsEncrypted) {
      throw new Error('Question channel credentials are unavailable.');
    }
    if (
      delivery.origin === QuestionAnswerOrigin.AUTOMATION &&
      (!delivery.draftAttemptId ||
        delivery.draftAttemptId !== delivery.question.draftAttempts[0]?.id ||
        !delivery.question.draftAttempts[0]?.autoSendEligible ||
        delivery.question.draftDecision !==
          QuestionReplyDecision.READY_FOR_SEND ||
        delivery.question.answer !== delivery.answer ||
        !isEmptyList(delivery.question.draftRisks) ||
        !isEmptyList(delivery.question.draftMissingInformation) ||
        (delivery.question.draftAttempts[0]?.answerability !== 'OUT_OF_SCOPE' &&
          !isNonEmptyList(delivery.question.draftEvidenceIds)) ||
        delivery.question.store.knowledgeProfile?.automationMode !==
          AiAutomationMode.SAFE_AUTO)
    ) {
      await this.rejectAutomaticDelivery(
        data,
        delivery.questionId,
        delivery.draftAttemptId,
        'Otomatik gönderim güvenlik koşulları artık karşılanmadığı için cevap gönderilmedi.',
      );
      return;
    }

    if (delivery.origin === QuestionAnswerOrigin.AUTOMATION) {
      const draft = delivery.question.draftAttempts[0];
      if (
        draft?.answerability !== 'OUT_OF_SCOPE' &&
        requiresInventoryVerification({
          evidenceIds: delivery.question.draftEvidenceIds,
          requestedFacts: draft?.requestedFacts,
          detectedFacts: draft?.detectedFacts,
        })
      ) {
        let reason: string | null = null;
        try {
          const verification =
            await this.inventoryVerification.verifyQuestionProduct(
              data.storeId,
              delivery.questionId,
            );
          if (
            !draft?.inventorySnapshotHash ||
            draft.inventorySnapshotHash !== verification.snapshotHash
          ) {
            reason =
              'Ürün veya varyantın stok durumu değişti. Cevabı göndermeden önce yeni taslak oluşturun.';
          }
        } catch (error) {
          if (error instanceof BillingAccessRequiredException) {
            await this.rejectAutomaticDelivery(
              data,
              delivery.questionId,
              delivery.draftAttemptId,
              BILLING_AUTOMATION_STOPPED_MESSAGE,
              false,
              true,
            );
            return;
          }
          reason =
            'Pazaryerinden güncel stok bilgisi doğrulanamadı. Cevabı göndermeden önce stoğu kontrol edin.';
        }
        if (reason) {
          await this.rejectAutomaticDelivery(
            data,
            delivery.questionId,
            delivery.draftAttemptId,
            reason,
            true,
          );
          return;
        }
      }

      const currentQuestion = await this.prisma.productQuestion.findFirst({
        where: {
          id: delivery.questionId,
          storeId: data.storeId,
          productId: delivery.question.productId,
          status: ProductQuestionStatus.DRAFTED,
          answer: delivery.answer,
          draftDecision: QuestionReplyDecision.READY_FOR_SEND,
          store: {
            status: StoreStatus.ACTIVE,
            knowledgeProfile: { automationMode: AiAutomationMode.SAFE_AUTO },
          },
          connection: {
            status: ChannelConnectionStatus.CONNECTED,
            credentialsEncrypted: delivery.connection.credentialsEncrypted,
          },
          answerDelivery: {
            id: delivery.id,
            status: QuestionAnswerStatus.PROCESSING,
          },
        },
        select: {
          draftAttempts: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { id: true, autoSendEligible: true },
          },
        },
      });
      if (
        currentQuestion?.draftAttempts[0]?.id !== delivery.draftAttemptId ||
        !currentQuestion?.draftAttempts[0]?.autoSendEligible
      ) {
        await this.rejectAutomaticDelivery(
          data,
          delivery.questionId,
          delivery.draftAttemptId,
          'Gönderim sırasında otomasyon ayarları veya soru durumu değişti.',
        );
        return;
      }
    }

    if (await stopIfSubscriptionInactive()) return;
    const credentials = this.encryption.decrypt(
      delivery.connection.credentialsEncrypted,
    );
    const result = await this.providers.sendProductQuestionAnswer(
      delivery.connection.providerKey,
      {
        environment: delivery.connection.environment,
        credentials,
      },
      delivery.question.externalQuestionId,
      delivery.answer,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.questionAnswer.update({
        where: { id: delivery.id },
        data: {
          status: QuestionAnswerStatus.SENT,
          externalAnswerId: result.externalAnswerId ?? null,
          sentAt: result.answeredAt,
          processingStartedAt: null,
          lastError: null,
        },
      });
      await transaction.productQuestion.update({
        where: { id: delivery.questionId },
        data: {
          status: ProductQuestionStatus.ANSWERED,
          answer: delivery.answer,
          answeredAt: result.answeredAt,
        },
      });
      if (delivery.draftAttemptId) {
        await transaction.aiDraftAttempt.update({
          where: { id: delivery.draftAttemptId },
          data: {
            outcome: AiDraftOutcome.SENT,
            finalizedAt: result.answeredAt,
          },
        });
      }
    });
    await this.audit.recordSafely({
      actorType: delivery.requestedByUserId
        ? AuditActorType.USER
        : AuditActorType.SYSTEM,
      actorUserId: delivery.requestedByUserId,
      origin: AuditOrigin.WORKER,
      action: AuditAction.QUESTION_ANSWER_SENT,
      result: AuditResult.SUCCESS,
      workspaceId: delivery.question.store.workspaceId,
      storeId: data.storeId,
      targetType: 'PRODUCT_QUESTION',
      targetId: delivery.questionId,
      metadata: {
        providerKey: delivery.connection.providerKey,
        answerOrigin: delivery.origin,
      },
    });
    await this.notifications.recordOperationalSuccess({
      storeId: data.storeId,
      connectionId: delivery.connectionId,
      kind: OperationalEmailIncidentKind.ANSWER_DELIVERY,
    });
    if (delivery.origin === QuestionAnswerOrigin.AUTOMATION) {
      await this.notifications.resolveOperationalWarning({
        storeId: data.storeId,
        kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
      });
    }
  }

  async markFinalFailure(data: QuestionAnswerJobData, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Cevap gönderilemedi.';

    const delivery = await this.prisma.questionAnswer.findFirst({
      where: { id: data.answerId, storeId: data.storeId },
      select: {
        questionId: true,
        connectionId: true,
        requestedByUserId: true,
        origin: true,
        question: { select: { store: { select: { workspaceId: true } } } },
      },
    });

    const updated = await this.prisma.questionAnswer.updateMany({
      where: {
        id: data.answerId,
        storeId: data.storeId,
        status: {
          notIn: [QuestionAnswerStatus.SENT, QuestionAnswerStatus.FAILED],
        },
      },
      data: {
        status: QuestionAnswerStatus.FAILED,
        processingStartedAt: null,
        lastError: message,
      },
    });

    if (updated.count > 0 && delivery) {
      await this.audit.recordSafely({
        actorType: delivery.requestedByUserId
          ? AuditActorType.USER
          : AuditActorType.SYSTEM,
        actorUserId: delivery.requestedByUserId,
        origin: AuditOrigin.WORKER,
        action: AuditAction.QUESTION_ANSWER_FAILED,
        result: AuditResult.FAILURE,
        workspaceId: delivery.question.store.workspaceId,
        storeId: data.storeId,
        targetType: 'PRODUCT_QUESTION',
        targetId: delivery.questionId,
        metadata: { answerOrigin: delivery.origin },
      });
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: NotificationType.ANSWER_DELIVERY_FAILED,
        severity: NotificationSeverity.ERROR,
        title: 'Cevap gönderilemedi',
        message:
          'Hazırlanan cevap pazaryerine iletilemedi. Soruyu inceleyip tekrar gönderebilirsiniz.',
        actionUrl: `/dashboard/inbox?question=${delivery.questionId}`,
        entityType: 'PRODUCT_QUESTION',
        entityId: delivery.questionId,
        dedupeKey: `answer-delivery-failed:${data.answerId}`,
      });

      if (isProviderAuthenticationError(error)) {
        await this.prisma.channelConnection.updateMany({
          where: { id: delivery.connectionId, storeId: data.storeId },
          data: {
            status: ChannelConnectionStatus.ERROR,
            failureReason: message.slice(0, 1_000),
          },
        });
        await this.notifications.createChannelConnectionError(
          data.storeId,
          delivery.connectionId,
        );
        await this.notifications.recordSyncFailure({
          storeId: data.storeId,
          connectionId: delivery.connectionId,
          kind: SyncEmailIncidentKind.AUTH,
          runId: data.answerId,
        });
      } else {
        await this.notifications.recordOperationalFailure({
          storeId: data.storeId,
          connectionId: delivery.connectionId,
          kind: OperationalEmailIncidentKind.ANSWER_DELIVERY,
        });
      }
    }
  }

  private async rejectAutomaticDelivery(
    data: QuestionAnswerJobData,
    questionId: string,
    draftAttemptId: string | null,
    message: string,
    inventoryInvalidated = false,
    billingBlocked = false,
  ) {
    const requiresReview = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.questionAnswer.updateMany({
          where: {
            id: data.answerId,
            storeId: data.storeId,
            origin: QuestionAnswerOrigin.AUTOMATION,
            draftAttemptId,
            status: {
              in: [
                QuestionAnswerStatus.QUEUED,
                QuestionAnswerStatus.PROCESSING,
              ],
            },
          },
          data: {
            status: QuestionAnswerStatus.FAILED,
            processingStartedAt: null,
            lastError: message,
          },
        });
        if (updated.count !== 1) return false;
        if (draftAttemptId) {
          await transaction.aiDraftAttempt.updateMany({
            where: { id: draftAttemptId, storeId: data.storeId },
            data: {
              outcome: AiDraftOutcome.AVAILABLE,
              finalizedAt: null,
              selectedAt: null,
              autoSendEligible: false,
              decision: QuestionReplyDecision.NEEDS_REVIEW,
              eligibilityReasons: ['REVIEW_REQUIRED'],
              ...(inventoryInvalidated
                ? {
                    autoSendEligible: false,
                    decision: QuestionReplyDecision.NEEDS_REVIEW,
                    confidence: 0.6,
                    answerability: 'PARTIAL',
                    risks: ['STALE_INVENTORY'],
                    missingInformation: [message],
                    eligibilityReasons: ['REVIEW_REQUIRED', 'RISK_DETECTED'],
                  }
                : {}),
            },
          });
        }
        if (billingBlocked) {
          await transaction.productQuestion.updateMany({
            where: {
              id: questionId,
              storeId: data.storeId,
              status: ProductQuestionStatus.DRAFTED,
            },
            data: { draftDecision: QuestionReplyDecision.NEEDS_REVIEW },
          });
        }
        if (inventoryInvalidated) {
          await transaction.productQuestion.updateMany({
            where: {
              id: questionId,
              storeId: data.storeId,
              status: ProductQuestionStatus.DRAFTED,
            },
            data: {
              draftDecision: QuestionReplyDecision.NEEDS_REVIEW,
              draftConfidence: 0.6,
              draftAnswerability: 'PARTIAL',
              draftRisks: ['STALE_INVENTORY'],
              draftMissingInformation: [message],
            },
          });
        }

        return true;
      },
    );

    if (requiresReview) {
      await this.notifications.createForStoreMembers({
        storeId: data.storeId,
        type: billingBlocked
          ? NotificationType.AI_AUTOMATION_PAUSED
          : NotificationType.AI_REVIEW_REQUIRED,
        severity: NotificationSeverity.WARNING,
        title: billingBlocked
          ? 'Otomatik gönderim durduruldu'
          : 'Yanıt incelemeniz gerekiyor',
        message: billingBlocked
          ? BILLING_AUTOMATION_STOPPED_MESSAGE
          : 'Otomatik gönderim güvenlik kontrolünü geçemedi. Taslağı kontrol ederek manuel gönderebilirsiniz.',
        actionUrl: `/dashboard/inbox?question=${questionId}`,
        entityType: billingBlocked ? 'STORE' : 'PRODUCT_QUESTION',
        entityId: billingBlocked ? data.storeId : questionId,
        dedupeKey: billingBlocked
          ? `ai-automation-paused:${data.storeId}:billing`
          : `ai-review-required:${questionId}`,
      });
      if (billingBlocked) {
        await this.notifications.recordOperationalFailure({
          storeId: data.storeId,
          kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
        });
      }
    }
  }

  private async failPendingDelivery(
    data: QuestionAnswerJobData,
    message: string,
  ) {
    await this.prisma.questionAnswer.updateMany({
      where: {
        id: data.answerId,
        storeId: data.storeId,
        status: {
          in: [QuestionAnswerStatus.QUEUED, QuestionAnswerStatus.PROCESSING],
        },
      },
      data: {
        status: QuestionAnswerStatus.FAILED,
        processingStartedAt: null,
        lastError: message,
      },
    });
  }
}

function isEmptyList(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isNonEmptyList(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
