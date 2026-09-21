import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ChannelConnectionStatus,
  ChannelType,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { activeBillingSubscriptionWhere } from '../billing/billing-access.policy';
import {
  DEFAULT_INVENTORY_SYNC_INTERVAL_MS,
  FULL_CATALOG_REFRESH_INTERVAL_MS,
  PRODUCT_SYNC_QUEUE,
  SCHEDULE_CONNECTED_INVENTORY_JOB,
} from './product-sync.constants';
import { ProductSyncQueueService } from './product-sync-queue.service';

const INVENTORY_SCHEDULER_JOB_ID = 'connected-inventory-sync-scheduler';

@Injectable()
export class ProductSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ProductSyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productSyncQueue: ProductSyncQueueService,
    @InjectQueue(PRODUCT_SYNC_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      INVENTORY_SCHEDULER_JOB_ID,
      { every: getInventorySyncInterval() },
      {
        name: SCHEDULE_CONNECTED_INVENTORY_JOB,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: failedJobRetention(25),
        },
      },
    );
  }

  async dispatchConnectedInventorySyncs() {
    const connections = await this.prisma.channelConnection.findMany({
      where: {
        type: ChannelType.COMMERCE,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
        store: {
          status: StoreStatus.ACTIVE,
          workspace: {
            billingSubscription: { is: activeBillingSubscriptionWhere() },
          },
        },
      },
      select: {
        id: true,
        storeId: true,
        lastSyncAt: true,
        externalProducts: {
          where: { variants: { some: {} } },
          take: 1,
          select: { id: true },
        },
      },
    });

    const results = await Promise.allSettled(
      connections.map((connection) => {
        const requiresFullSync =
          connection.externalProducts.length === 0 ||
          !connection.lastSyncAt ||
          connection.lastSyncAt.getTime() <
            Date.now() - FULL_CATALOG_REFRESH_INTERVAL_MS;

        return this.productSyncQueue.enqueue(
          connection.storeId,
          connection.id,
          requiresFullSync ? 'FULL' : 'INVENTORY',
          { trigger: 'SCHEDULED' },
        );
      }),
    );
    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedCount > 0 && failedCount !== connections.length) {
      this.logger.warn(
        `${failedCount} inventory sync job could not be queued; locked connections are skipped.`,
      );
    }
  }
}

function getInventorySyncInterval() {
  const configured = Number(process.env.INVENTORY_SYNC_INTERVAL_MS);

  if (Number.isFinite(configured) && configured >= 60_000) {
    return Math.trunc(configured);
  }

  return DEFAULT_INVENTORY_SYNC_INTERVAL_MS;
}
