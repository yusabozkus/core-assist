import { Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  ProductQuestionStatus,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { InventoryVerificationService } from '../inventory-verification/inventory-verification.service';
import type { QuestionAnswerJobData } from './question-answer.types';
import { requiresInventoryVerification } from './automatic-answer-inventory.guard';

@Injectable()
export class QuestionAnswerWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    private readonly inventoryVerification: InventoryVerificationService,
  ) {}

  async run(data: QuestionAnswerJobData) {
    const delivery = await this.prisma.questionAnswer.findFirst({
      where: { id: data.answerId, storeId: data.storeId },
      select: {
        id: true,
        answer: true,
        origin: true,
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
                inventorySnapshotHash: true,
                requestedFacts: true,
                detectedFacts: true,
              },
            },
            store: {
              select: {
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
        delivery.draftAttemptId,
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
        !isNonEmptyList(delivery.question.draftEvidenceIds) ||
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
        } catch {
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

      // Settings, product mapping or the selected draft may change while the API check is running.
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
  }

  async markFinalFailure(data: QuestionAnswerJobData, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Cevap gönderilemedi.';

    const delivery = await this.prisma.questionAnswer.findFirst({
      where: { id: data.answerId, storeId: data.storeId },
      select: { draftAttemptId: true },
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.questionAnswer.updateMany({
        where: {
          id: data.answerId,
          storeId: data.storeId,
          status: { not: QuestionAnswerStatus.SENT },
        },
        data: {
          status: QuestionAnswerStatus.FAILED,
          processingStartedAt: null,
          lastError: message,
        },
      });
      if (delivery?.draftAttemptId) {
        await transaction.aiDraftAttempt.updateMany({
          where: { id: delivery.draftAttemptId },
          data: {
            outcome: AiDraftOutcome.FAILED,
            finalizedAt: new Date(),
          },
        });
      }
    });
  }

  private async rejectAutomaticDelivery(
    data: QuestionAnswerJobData,
    questionId: string,
    draftAttemptId: string | null,
    message: string,
    inventoryInvalidated = false,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.questionAnswer.updateMany({
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
      if (updated.count !== 1) return;
      if (draftAttemptId) {
        await transaction.aiDraftAttempt.updateMany({
          where: { id: draftAttemptId, storeId: data.storeId },
          data: {
            outcome: AiDraftOutcome.FAILED,
            finalizedAt: new Date(),
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
    });
  }

  private async failPendingDelivery(
    data: QuestionAnswerJobData,
    draftAttemptId: string | null,
    message: string,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.questionAnswer.updateMany({
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
      if (updated.count !== 1 || !draftAttemptId) return;

      await transaction.aiDraftAttempt.updateMany({
        where: { id: draftAttemptId, storeId: data.storeId },
        data: {
          outcome: AiDraftOutcome.FAILED,
          finalizedAt: new Date(),
        },
      });
    });
  }
}

function isEmptyList(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isNonEmptyList(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
