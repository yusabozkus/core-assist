import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  CatalogSyncKind,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import {
  QUESTION_SYNC_LOCK_TIMEOUT_MS,
  QUESTION_SYNC_QUEUE,
  SYNC_STORE_QUESTIONS_JOB,
} from './question-sync.constants';
import type {
  QueuedQuestionSync,
  QuestionSyncDispatcher,
  QuestionSyncEnqueueOptions,
  QuestionSyncJobData,
} from './question-sync.types';

@Injectable()
export class QuestionSyncQueueService implements QuestionSyncDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    @InjectQueue(QUESTION_SYNC_QUEUE)
    private readonly queue: Queue<QuestionSyncJobData>,
    private readonly billing: BillingSubscriptionService,
  ) {}

  async enqueue(
    storeId: string,
    connectionId: string,
    options: QuestionSyncEnqueueOptions = {},
  ): Promise<QueuedQuestionSync> {
    await this.billing.assertStoreAccess(storeId, BILLING_SYNC_STOPPED_MESSAGE);
    const queuedAt = new Date();
    const staleBefore = new Date(
      queuedAt.getTime() - QUESTION_SYNC_LOCK_TIMEOUT_MS,
    );
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        id: connectionId,
        storeId,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        store: { status: StoreStatus.ACTIVE },
      },
      select: { providerKey: true },
    });

    if (
      !connection ||
      !this.providers.supportsProductQuestions(connection.providerKey)
    ) {
      throw new ConflictException(
        'Bu bağlantı için ürün sorusu senkronizasyonu desteklenmiyor.',
      );
    }

    const lock = await this.prisma.channelConnection.updateMany({
      where: {
        id: connectionId,
        storeId,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        store: { status: StoreStatus.ACTIVE },
        OR: [
          { questionSyncStartedAt: null },
          { questionSyncStartedAt: { lt: staleBefore } },
        ],
      },
      data: {
        questionSyncStartedAt: queuedAt,
        questionSyncFailureReason: null,
      },
    });

    if (lock.count !== 1) {
      throw new ConflictException(
        'Bu bağlantı için soru senkronizasyonu zaten çalışıyor.',
      );
    }

    let syncRunId: string | undefined;

    try {
      const syncRun = await this.prisma.catalogSyncRun.create({
        data: {
          connectionId,
          kind: CatalogSyncKind.QUESTION,
          trigger: options.trigger ?? 'MANUAL',
          retryOfId: options.retryOfId,
        },
        select: { id: true },
      });
      syncRunId = syncRun.id;

      await this.queue.add(
        SYNC_STORE_QUESTIONS_JOB,
        { storeId, connectionId, syncRunId },
        {
          jobId: `question-sync-${connectionId}-${queuedAt.getTime()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 250 },
        },
      );

      return { syncRunId, connectionId, status: 'RUNNING', queuedAt };
    } catch (error) {
      await this.releaseFailedEnqueue(connectionId, syncRunId);
      throw new ServiceUnavailableException(
        'Soru senkronizasyonu kuyruğuna şu anda ulaşılamıyor.',
        { cause: error },
      );
    }
  }

  private async releaseFailedEnqueue(connectionId: string, syncRunId?: string) {
    const operations = [
      this.prisma.channelConnection.updateMany({
        where: { id: connectionId },
        data: {
          questionSyncStartedAt: null,
          questionSyncFailureReason: 'Soru senkronizasyonu kuyruğa eklenemedi.',
        },
      }),
    ];

    if (syncRunId) {
      operations.push(
        this.prisma.catalogSyncRun.updateMany({
          where: { id: syncRunId },
          data: {
            status: CatalogSyncStatus.FAILED,
            stage: 'FAILED',
            progress: 100,
            errorMessage: 'Soru senkronizasyonu işi kuyruğa eklenemedi.',
            completedAt: new Date(),
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
  }
}
