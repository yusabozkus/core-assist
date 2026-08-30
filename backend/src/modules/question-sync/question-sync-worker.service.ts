import { Injectable } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  IncomingEventProcessingStatus,
  IncomingEventType,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import type { NormalizedProductQuestion } from '../channels/providers/question-connector';
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
  ) {}

  async run(data: QuestionSyncJobData) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: data.connectionId,
        storeId: data.storeId,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        connectedAt: { not: null },
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
    let cursor: string | undefined;
    let batchCount = 0;
    let questionsProcessed = 0;

    do {
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
        if (await this.persistQuestion(syncConnection, question)) {
          questionsProcessed += 1;
        }
      }

      cursor = batch.nextCursor;
      batchCount += 1;

      if (batchCount >= QUESTION_SYNC_MAX_BATCHES && cursor) {
        throw new Error('Question sync exceeded the maximum batch count.');
      }
    } while (cursor);

    await this.prisma.channelConnection.updateMany({
      where: { id: syncConnection.id, storeId: syncConnection.storeId },
      data: {
        questionSyncStartedAt: null,
        lastQuestionSyncAt: new Date(),
        questionSyncFailureReason: null,
      },
    });

    return { questionsProcessed };
  }

  async markFinalFailure(data: QuestionSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Soru senkronizasyonu tamamlanamadı.';

    await this.prisma.channelConnection.updateMany({
      where: { id: data.connectionId, storeId: data.storeId },
      data: {
        questionSyncStartedAt: null,
        questionSyncFailureReason: message,
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
      if (isUniqueConstraintError(error)) return false;
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
      return false;
    }

    try {
      const externalProduct = await this.prisma.externalProduct.findUnique({
        where: {
          connectionId_externalId: {
            connectionId: connection.id,
            externalId: question.externalProductId,
          },
        },
        select: { id: true, productId: true },
      });

      await this.prisma.$transaction([
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
            externalCreatedAt: question.createdAt,
          },
        }),
        this.prisma.incomingEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: IncomingEventProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        }),
      ]);
      return true;
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
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
