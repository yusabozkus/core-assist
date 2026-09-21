import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  CatalogSyncStatus,
  CatalogSyncKind,
  ChannelConnectionStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import {
  PRODUCT_SYNC_LOCK_TIMEOUT_MS,
  PRODUCT_SYNC_QUEUE,
  SYNC_STORE_INVENTORY_JOB,
  SYNC_STORE_PRODUCTS_JOB,
} from './product-sync.constants';
import type {
  ProductSyncDispatcher,
  ProductSyncEnqueueOptions,
  ProductSyncJobData,
  ProductSyncKind,
  QueuedProductSync,
} from './product-sync.types';

@Injectable()
export class ProductSyncQueueService implements ProductSyncDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PRODUCT_SYNC_QUEUE)
    private readonly queue: Queue<ProductSyncJobData>,
    private readonly billing: BillingSubscriptionService,
  ) {}

  async enqueue(
    storeId: string,
    connectionId: string,
    kind: ProductSyncKind = 'FULL',
    options: ProductSyncEnqueueOptions = {},
  ): Promise<QueuedProductSync> {
    await this.billing.assertStoreAccess(storeId, BILLING_SYNC_STOPPED_MESSAGE);
    const queuedAt = new Date();
    const staleBefore = new Date(
      queuedAt.getTime() - PRODUCT_SYNC_LOCK_TIMEOUT_MS,
    );
    const lock = await this.prisma.channelConnection.updateMany({
      where: {
        id: connectionId,
        storeId,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        store: { status: StoreStatus.ACTIVE },
        OR: [
          { processingStartedAt: null },
          { processingStartedAt: { lt: staleBefore } },
        ],
      },
      data: {
        processingStartedAt: queuedAt,
        failureReason: null,
      },
    });

    if (lock.count !== 1) {
      throw new ConflictException(
        'Bu bağlantı için ürün senkronizasyonu zaten çalışıyor.',
      );
    }

    let syncRunId: string | undefined;

    try {
      const syncRun = await this.prisma.catalogSyncRun.create({
        data: {
          connectionId,
          trigger: options.trigger ?? 'MANUAL',
          retryOfId: options.retryOfId,
          kind:
            kind === 'INVENTORY'
              ? CatalogSyncKind.INVENTORY
              : CatalogSyncKind.FULL,
        },
        select: { id: true },
      });
      syncRunId = syncRun.id;

      await this.queue.add(
        kind === 'INVENTORY'
          ? SYNC_STORE_INVENTORY_JOB
          : SYNC_STORE_PRODUCTS_JOB,
        { storeId, connectionId, syncRunId, kind, checkpointBatch: 0 },
        {
          jobId: `sync-${connectionId}-${syncRunId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: failedJobRetention(250),
        },
      );

      return { syncRunId, status: 'RUNNING', queuedAt, kind };
    } catch (error) {
      await this.releaseFailedEnqueue(connectionId, syncRunId);
      throw new ServiceUnavailableException(
        'Senkronizasyon kuyruğuna şu anda ulaşılamıyor.',
        { cause: error },
      );
    }
  }

  private async releaseFailedEnqueue(connectionId: string, syncRunId?: string) {
    const operations = [
      this.prisma.channelConnection.updateMany({
        where: { id: connectionId },
        data: { processingStartedAt: null },
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
            errorMessage: 'Senkronizasyon işi kuyruğa eklenemedi.',
            completedAt: new Date(),
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
  }
}
