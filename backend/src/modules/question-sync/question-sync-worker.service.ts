import { Inject, Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  IncomingEventProcessingStatus,
  IncomingEventType,
  ProductQuestionStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import type { NormalizedProductQuestion } from '../channels/providers/question-connector';
import { evaluateQuestionResponsePolicy } from '../questions/question-response-policy.service';
import { QUESTION_DRAFT_DISPATCHER } from '../questions/question-draft.constants';
import type { QuestionDraftDispatcher } from '../questions/question-draft.types';
import { QUESTION_SYNC_MAX_BATCHES } from './question-sync.constants';
import type { QuestionSyncJobData } from './question-sync.types';

type QuestionSyncConnection = {
  id: string;
  storeId: string;
  providerKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  credentialsEncrypted: string;
  connectedAt: Date;
};

@Injectable()
export class QuestionSyncWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    @Inject(QUESTION_DRAFT_DISPATCHER)
    private readonly questionDrafts: QuestionDraftDispatcher,
  ) {}

  async run(data: QuestionSyncJobData) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: data.connectionId,
        storeId: data.storeId,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        connectedAt: { not: null },
        store: { status: StoreStatus.ACTIVE },
      },
      select: {
        id: true,
        storeId: true,
        providerKey: true,
        environment: true,
        credentialsEncrypted: true,
        connectedAt: true,
      },
    });

    if (!connection?.credentialsEncrypted || !connection.connectedAt) {
      throw new Error('Question sync connection is not available.');
    }

    const syncConnection = connection as QuestionSyncConnection;
    const credentials = this.encryption.decrypt(
      syncConnection.credentialsEncrypted,
    );

    if (syncConnection.environment === 'SANDBOX') {
      await this.removeLegacyMockQuestions(syncConnection);
    }

    const knowledgeProfile = await this.prisma.storeKnowledgeProfile.findUnique(
      {
        where: { storeId: syncConnection.storeId },
        select: { automationMode: true },
      },
    );
    const automaticDraftsEnabled =
      knowledgeProfile?.automationMode === AiAutomationMode.DRAFT_ONLY ||
      knowledgeProfile?.automationMode === AiAutomationMode.SAFE_AUTO;

    let cursor: string | undefined;
    let batchCount = 0;
    let questionsProcessed = 0;

    do {
      let batchQuestionsProcessed = 0;
      const batch = await this.providers.fetchProductQuestions(
        syncConnection.providerKey,
        {
          environment: syncConnection.environment,
          credentials,
        },
        {
          cursor,
          createdAfter: syncConnection.connectedAt,
        },
      );

      for (const question of batch.questions) {
        const persisted = await this.persistQuestion(syncConnection, question);

        if (persisted?.isNew) {
          questionsProcessed += 1;
          batchQuestionsProcessed += 1;
        }

        if (
          automaticDraftsEnabled &&
          persisted?.status === ProductQuestionStatus.PENDING
        ) {
          await this.questionDrafts.enqueue(
            syncConnection.storeId,
            persisted.id,
          );
        }
      }

      cursor = batch.nextCursor;
      batchCount += 1;

      await this.prisma.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: syncConnection.id },
        data: {
          questionsProcessed: { increment: batchQuestionsProcessed },
        },
      });

      if (batchCount >= QUESTION_SYNC_MAX_BATCHES && cursor) {
        throw new Error('Question sync exceeded the maximum batch count.');
      }
    } while (cursor);

    const completedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: syncConnection.id },
        data: {
          status: CatalogSyncStatus.COMPLETED,
          errorMessage: null,
          completedAt,
        },
      }),
      this.prisma.channelConnection.updateMany({
        where: { id: syncConnection.id, storeId: syncConnection.storeId },
        data: {
          questionSyncStartedAt: null,
          lastQuestionSyncAt: completedAt,
          questionSyncFailureReason: null,
        },
      }),
    ]);

    return { questionsProcessed };
  }

  async markFinalFailure(data: QuestionSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Soru senkronizasyonu tamamlanamadı.';

    await this.prisma.$transaction([
      this.prisma.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: data.connectionId },
        data: {
          status: CatalogSyncStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
      this.prisma.channelConnection.updateMany({
        where: { id: data.connectionId, storeId: data.storeId },
        data: {
          questionSyncStartedAt: null,
          questionSyncFailureReason: message,
        },
      }),
    ]);
  }

  private async removeLegacyMockQuestions(connection: QuestionSyncConnection) {
    const legacyPrefix =
      connection.providerKey === 'hepsiburada'
        ? 'hb-question-'
        : 'ty-question-';

    await this.prisma.incomingEvent.deleteMany({
      where: {
        connectionId: connection.id,
        externalEventId: { startsWith: legacyPrefix },
      },
    });
  }

  private async persistQuestion(
    connection: QuestionSyncConnection,
    question: NormalizedProductQuestion,
  ) {
    let event: { id: string };

    try {
      event = await this.prisma.incomingEvent.create({
        data: {
          storeId: connection.storeId,
          connectionId: connection.id,
          externalEventId: question.externalId,
          eventType: IncomingEventType.PRODUCT_QUESTION,
          externalCreatedAt: question.createdAt,
          payload: question.rawPayload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (connection.environment === 'SANDBOX') {
          await this.prisma.productQuestion.updateMany({
            where: {
              connectionId: connection.id,
              externalQuestionId: question.externalId,
            },
            data: {
              externalCustomerId: question.externalCustomerId,
              customerName: question.customerName,
            },
          });
        }

        const existingQuestion = await this.prisma.productQuestion.findUnique({
          where: {
            connectionId_externalQuestionId: {
              connectionId: connection.id,
              externalQuestionId: question.externalId,
            },
          },
          select: { id: true, status: true },
        });

        return existingQuestion
          ? { ...existingQuestion, isNew: false as const }
          : null;
      }
      throw error;
    }

    if (question.createdAt < connection.connectedAt) {
      await this.prisma.incomingEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: IncomingEventProcessingStatus.IGNORED,
          ignoreReason: 'Question predates the channel connection.',
          processedAt: new Date(),
        },
      });
      return null;
    }

    try {
      const externalProduct = await this.resolveExternalProduct(
        connection.id,
        question.externalProductId,
      );
      const responsePolicy = evaluateQuestionResponsePolicy(question.text);

      const questionStatus =
        responsePolicy.action === 'DO_NOT_REPLY'
          ? ProductQuestionStatus.IGNORED
          : ProductQuestionStatus.PENDING;
      const [persistedQuestion] = await this.prisma.$transaction([
        this.prisma.productQuestion.create({
          data: {
            storeId: connection.storeId,
            connectionId: connection.id,
            incomingEventId: event.id,
            productId: externalProduct?.productId,
            externalProductRecordId: externalProduct?.id,
            externalQuestionId: question.externalId,
            externalProductId: question.externalProductId,
            externalCustomerId: question.externalCustomerId,
            customerName: question.customerName,
            question: question.text,
            referenceAnswer: question.referenceAnswer,
            referenceSourceUrl: question.referenceSourceUrl,
            referenceSourceProvider: question.referenceSourceProvider,
            status: questionStatus,
            externalCreatedAt: question.createdAt,
          },
          select: { id: true, status: true },
        }),
        this.prisma.incomingEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: IncomingEventProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        }),
      ]);
      return { ...persistedQuestion, isNew: true as const };
    } catch (error) {
      await this.prisma.incomingEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: IncomingEventProcessingStatus.FAILED,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Question processing failed.',
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async resolveExternalProduct(
    connectionId: string,
    externalProductId: string,
  ) {
    const exactProduct = await this.prisma.externalProduct.findUnique({
      where: {
        connectionId_externalId: {
          connectionId,
          externalId: externalProductId,
        },
      },
      select: { id: true, productId: true },
    });

    if (exactProduct) return exactProduct;

    const matchedVariant = await this.prisma.externalProductVariant.findFirst({
      where: {
        externalProduct: { connectionId },
        OR: [
          { externalId: externalProductId },
          { sku: externalProductId },
          { barcode: externalProductId },
        ],
      },
      select: {
        externalProduct: { select: { id: true, productId: true } },
      },
    });

    return matchedVariant?.externalProduct ?? null;
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
