import { Inject, Injectable } from '@nestjs/common';
import {
  AiAutomationMode,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  IncomingEventProcessingStatus,
  IncomingEventType,
  NotificationSeverity,
  NotificationType,
  ProductQuestionStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { isProviderAuthenticationError } from '../channels/providers/connector-utils';
import type { NormalizedProductQuestion } from '../channels/providers/question-connector';
import { NotificationsService } from '../notifications/notifications.service';
import { QuestionProductLinkService } from '../question-product-link/question-product-link.service';
import { evaluateQuestionResponsePolicy } from '../questions/question-response-policy.service';
import { QUESTION_DRAFT_DISPATCHER } from '../questions/question-draft.constants';
import type { QuestionDraftDispatcher } from '../questions/question-draft.types';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
  auditErrorCode,
} from '../audit/audit-log.service';
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
    private readonly notifications: NotificationsService,
    private readonly productLinks: QuestionProductLinkService,
    private readonly billing: BillingSubscriptionService,
    private readonly audit: AuditLogService,
  ) {}

  async run(data: QuestionSyncJobData) {
    await this.billing.assertStoreAccess(
      data.storeId,
      BILLING_SYNC_STOPPED_MESSAGE,
    );
    await this.prisma.catalogSyncRun.updateMany({
      where: { id: data.syncRunId, connectionId: data.connectionId },
      data: { stage: 'FETCHING', progress: 10 },
    });

    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: data.connectionId,
        storeId: data.storeId,
        status: data.recoverErroredConnection
          ? {
              in: [
                ChannelConnectionStatus.CONNECTED,
                ChannelConnectionStatus.ERROR,
              ],
            }
          : ChannelConnectionStatus.CONNECTED,
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
      knowledgeProfile?.automationMode === AiAutomationMode.SHADOW ||
      knowledgeProfile?.automationMode === AiAutomationMode.SAFE_AUTO;

    let cursor: string | undefined;
    let batchCount = 0;
    let questionsProcessed = 0;
    let questionsUnchanged = 0;

    do {
      await this.billing.assertStoreAccess(
        data.storeId,
        BILLING_SYNC_STOPPED_MESSAGE,
      );
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

      await this.billing.assertStoreAccess(
        data.storeId,
        BILLING_SYNC_STOPPED_MESSAGE,
      );
      for (const question of batch.questions) {
        const persisted = await this.persistQuestion(syncConnection, question);

        if (persisted?.isNew) {
          questionsProcessed += 1;
          batchQuestionsProcessed += 1;
        } else if (persisted && !persisted.isNew) {
          questionsUnchanged += 1;
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
          questionsUnchanged,
          stage: 'PERSISTING',
          progress: Math.min(90, 20 + batchCount * 5),
        },
      });

      if (batchCount >= QUESTION_SYNC_MAX_BATCHES && cursor) {
        throw new Error('Question sync exceeded the maximum batch count.');
      }
    } while (cursor);

    await this.billing.assertStoreAccess(
      data.storeId,
      BILLING_SYNC_STOPPED_MESSAGE,
    );
    const completedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: data.storeId },
        select: { workspaceId: true },
      });
      await transaction.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: syncConnection.id },
        data: {
          status: CatalogSyncStatus.COMPLETED,
          stage: 'COMPLETED',
          progress: 100,
          errorMessage: null,
          completedAt,
        },
      });
      await transaction.channelConnection.updateMany({
        where: { id: syncConnection.id, storeId: syncConnection.storeId },
        data: {
          questionSyncStartedAt: null,
          lastQuestionSyncAt: completedAt,
          questionSyncFailureReason: null,
          ...(data.recoverErroredConnection
            ? {
                status: ChannelConnectionStatus.CONNECTED,
                failureReason: null,
              }
            : {}),
        },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.SYSTEM,
          origin: AuditOrigin.WORKER,
          action: AuditAction.QUESTION_SYNC_COMPLETED,
          result: AuditResult.SUCCESS,
          workspaceId: store.workspaceId,
          storeId: data.storeId,
          targetType: 'CATALOG_SYNC_RUN',
          targetId: data.syncRunId,
          after: { questionsProcessed, questionsUnchanged, batchCount },
          metadata: { connectionId: data.connectionId },
        },
        transaction,
      );
    });

    return { questionsProcessed };
  }

  async markFinalFailure(data: QuestionSyncJobData, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Soru senkronizasyonu tamamlanamadı.';

    const authenticationError = isProviderAuthenticationError(error);
    const accessError = error instanceof BillingAccessRequiredException;

    await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUniqueOrThrow({
        where: { id: data.storeId },
        select: { workspaceId: true },
      });
      await transaction.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: data.connectionId },
        data: {
          status: CatalogSyncStatus.FAILED,
          stage: 'FAILED',
          progress: 100,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await transaction.channelConnection.updateMany({
        where: { id: data.connectionId, storeId: data.storeId },
        data: {
          ...(authenticationError
            ? {
                status: ChannelConnectionStatus.ERROR,
                failureReason: message,
              }
            : {}),
          questionSyncStartedAt: null,
          questionSyncFailureReason: message,
        },
      });
      await this.audit.record(
        {
          actorType: AuditActorType.SYSTEM,
          origin: AuditOrigin.WORKER,
          action: AuditAction.QUESTION_SYNC_FAILED,
          result: AuditResult.FAILURE,
          workspaceId: store.workspaceId,
          storeId: data.storeId,
          targetType: 'CATALOG_SYNC_RUN',
          targetId: data.syncRunId,
          errorCode: auditErrorCode(error),
          metadata: {
            connectionId: data.connectionId,
            authenticationError,
            accessError,
          },
        },
        transaction,
      );
    });

    await this.notifications.createForStoreMembers({
      storeId: data.storeId,
      type: NotificationType.QUESTION_SYNC_FAILED,
      severity: accessError
        ? NotificationSeverity.WARNING
        : NotificationSeverity.ERROR,
      title: accessError
        ? 'Soru senkronizasyonu durduruldu'
        : 'Soru senkronizasyonu başarısız',
      message: accessError
        ? BILLING_SYNC_STOPPED_MESSAGE
        : 'Pazaryerinden yeni ürün soruları alınamadı. Senkronizasyon geçmişini inceleyin.',
      actionUrl: accessError
        ? '/billing'
        : '/dashboard/channels/sync?status=failed&kind=question',
      entityType: 'CATALOG_SYNC_RUN',
      entityId: data.syncRunId,
      dedupeKey: `question-sync-failed:${data.connectionId}`,
    });

    if (authenticationError) {
      await this.notifications.createChannelConnectionError(
        data.storeId,
        data.connectionId,
      );
    }
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

        if (existingQuestion) {
          await this.productLinks.linkQuestionIfPossible(
            connection.storeId,
            existingQuestion.id,
          );
        }

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
      const externalProduct = await this.productLinks.resolveExternalProduct(
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
            productTitleSnapshot: externalProduct?.product.title,
            productImageUrlSnapshot:
              externalProduct?.product.images[0]?.url ?? null,
            externalQuestionId: question.externalId,
            externalProductId: question.externalProductId,
            externalCustomerId: question.externalCustomerId,
            customerName: question.customerName,
            question: question.text,
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
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
