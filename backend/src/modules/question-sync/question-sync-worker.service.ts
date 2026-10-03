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
  SyncEmailIncidentKind,
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
import { normalizeTrendyolQuestion } from '../channels/providers/trendyol.connector';
import { normalizeHepsiburadaQuestion } from '../channels/providers/hepsiburada.connector';
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
    let questionsProcessed = await this.replayStoredQuestions(
      syncConnection,
      automaticDraftsEnabled,
    );
    let questionsUnchanged = 0;

    if (questionsProcessed) {
      await this.prisma.catalogSyncRun.updateMany({
        where: { id: data.syncRunId, connectionId: syncConnection.id },
        data: { questionsProcessed: { increment: questionsProcessed } },
      });
    }

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

    await this.notifications.resolveSyncFailures(data.connectionId, [
      SyncEmailIncidentKind.QUESTION,
      SyncEmailIncidentKind.AUTH,
    ]);
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

    if (!accessError) {
      await this.notifications.recordSyncFailure({
        storeId: data.storeId,
        connectionId: data.connectionId,
        kind: authenticationError
          ? SyncEmailIncidentKind.AUTH
          : SyncEmailIncidentKind.QUESTION,
        runId: data.syncRunId,
      });
    }

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

  private async replayStoredQuestions(
    connection: QuestionSyncConnection,
    automaticDraftsEnabled: boolean,
  ) {
    let recovered = 0;
    let cursor: string | undefined;
    do {
      const events = await this.prisma.incomingEvent.findMany({
        where: {
          connectionId: connection.id,
          storeId: connection.storeId,
          processingStatus: {
            in: [
              IncomingEventProcessingStatus.PENDING,
              IncomingEventProcessingStatus.FAILED,
            ],
          },
          question: { is: null },
        },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, externalEventId: true, payload: true },
      });
      for (const event of events) {
        await this.billing.assertStoreAccess(
          connection.storeId,
          BILLING_SYNC_STOPPED_MESSAGE,
        );
        if (
          !event.payload ||
          Array.isArray(event.payload) ||
          typeof event.payload !== 'object'
        )
          continue;
        const question =
          connection.providerKey === 'trendyol'
            ? normalizeTrendyolQuestion(event.payload)
            : connection.providerKey === 'hepsiburada'
              ? normalizeHepsiburadaQuestion(event.payload)
              : null;
        // Incomplete legacy/mock payloads must wait for a fresh provider fetch.
        if (!question || question.externalId !== event.externalEventId)
          continue;
        const persisted = await this.persistQuestion(connection, question);
        if (persisted?.isNew) recovered += 1;
        if (
          automaticDraftsEnabled &&
          persisted?.status === ProductQuestionStatus.PENDING
        ) {
          await this.questionDrafts.enqueue(connection.storeId, persisted.id);
        }
      }
      cursor = events.length === 100 ? events[events.length - 1].id : undefined;
    } while (cursor);
    return recovered;
  }

  private async persistQuestion(
    connection: QuestionSyncConnection,
    question: NormalizedProductQuestion,
  ) {
    // An existing event is a receipt, not proof that its question was saved.
    // An empty-update upsert can become a client-side read/create and race on
    // first delivery. PostgreSQL ON CONFLICT DO NOTHING serializes the insert.
    await this.prisma.incomingEvent.createMany({
      data: {
        storeId: connection.storeId,
        connectionId: connection.id,
        externalEventId: question.externalId,
        eventType: IncomingEventType.PRODUCT_QUESTION,
        externalCreatedAt: question.createdAt,
        payload: question.rawPayload as Prisma.InputJsonValue,
      },
      skipDuplicates: true,
    });
    const event = await this.prisma.incomingEvent.findUniqueOrThrow({
      where: {
        connectionId_externalEventId: {
          connectionId: connection.id,
          externalEventId: question.externalId,
        },
      },
      select: { id: true },
    });

    try {
      const externalProduct = await this.productLinks.resolveExternalProduct(
        connection.id,
        question.externalProductId,
      );
      const responsePolicy = evaluateQuestionResponsePolicy(question.text);
      const persisted = await this.prisma.$transaction(async (transaction) => {
        // Serialize duplicates and legacy FAILED/PENDING events. A crash rolls
        // back both question creation and event completion.
        await transaction.$queryRaw`
          SELECT "id" FROM "incoming_event" WHERE "id" = ${event.id} FOR UPDATE
        `;
        const existing = await transaction.productQuestion.findUnique({
          where: {
            connectionId_externalQuestionId: {
              connectionId: connection.id,
              externalQuestionId: question.externalId,
            },
          },
          select: { id: true, status: true },
        });
        if (existing) {
          if (connection.environment === 'SANDBOX') {
            await transaction.productQuestion.update({
              where: { id: existing.id },
              data: {
                externalCustomerId: question.externalCustomerId,
                customerName: question.customerName,
              },
            });
          }
          await transaction.incomingEvent.update({
            where: { id: event.id },
            data: {
              processingStatus: IncomingEventProcessingStatus.PROCESSED,
              processedAt: new Date(),
              errorMessage: null,
              ignoreReason: null,
            },
          });
          return { ...existing, isNew: false };
        }
        if (question.createdAt < connection.connectedAt) {
          await transaction.incomingEvent.update({
            where: { id: event.id },
            data: {
              processingStatus: IncomingEventProcessingStatus.IGNORED,
              ignoreReason: 'Question predates the channel connection.',
              errorMessage: null,
              processedAt: new Date(),
            },
          });
          return null;
        }
        const created = await transaction.productQuestion.create({
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
            status:
              responsePolicy.action === 'DO_NOT_REPLY'
                ? ProductQuestionStatus.IGNORED
                : ProductQuestionStatus.PENDING,
            externalCreatedAt: question.createdAt,
          },
          select: { id: true, status: true },
        });
        await transaction.incomingEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: IncomingEventProcessingStatus.PROCESSED,
            processedAt: new Date(),
            errorMessage: null,
            ignoreReason: null,
          },
        });
        return { ...created, isNew: true };
      });
      if (persisted && !persisted.isNew) {
        await this.productLinks.linkQuestionIfPossible(
          connection.storeId,
          persisted.id,
        );
      }
      return persisted;
    } catch (error) {
      await this.prisma.incomingEvent.updateMany({
        where: {
          id: event.id,
          processingStatus: {
            in: [
              IncomingEventProcessingStatus.PENDING,
              IncomingEventProcessingStatus.FAILED,
            ],
          },
        },
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
