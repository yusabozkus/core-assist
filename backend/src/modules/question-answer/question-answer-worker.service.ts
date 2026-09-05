import { Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  ProductQuestionStatus,
  ProductVariantStatus,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import type { QuestionAnswerJobData } from './question-answer.types';
import { hasFreshInventoryForAutomaticAnswer } from './automatic-answer-inventory.guard';

@Injectable()
export class QuestionAnswerWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
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
              select: { id: true, autoSendEligible: true },
            },
            product: {
              select: {
                variants: {
                  where: { status: { not: ProductVariantStatus.ARCHIVED } },
                  select: { lastSyncedAt: true },
                },
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
    if (delivery.status === QuestionAnswerStatus.SENT) return;
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
        !hasFreshInventoryForAutomaticAnswer(
          delivery.question.draftEvidenceIds,
          delivery.question.product?.variants ?? [],
        ) ||
        delivery.question.store.knowledgeProfile?.automationMode !==
          AiAutomationMode.SAFE_AUTO)
    ) {
      await this.prisma.questionAnswer.updateMany({
        where: { id: delivery.id, status: QuestionAnswerStatus.QUEUED },
        data: {
          status: QuestionAnswerStatus.FAILED,
          lastError:
            'Otomatik gönderim güvenlik koşulları artık karşılanmadığı için cevap gönderilmedi.',
        },
      });
      if (delivery.draftAttemptId) {
        await this.prisma.aiDraftAttempt.updateMany({
          where: { id: delivery.draftAttemptId },
          data: {
            outcome: AiDraftOutcome.FAILED,
            finalizedAt: new Date(),
          },
        });
      }
      return;
    }

    await this.prisma.questionAnswer.update({
      where: { id: delivery.id },
      data: {
        status: QuestionAnswerStatus.PROCESSING,
        attempts: { increment: 1 },
        processingStartedAt: new Date(),
        lastError: null,
      },
    });

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
}

function isEmptyList(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isNonEmptyList(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
