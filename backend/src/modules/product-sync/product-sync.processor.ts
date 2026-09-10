import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import {
  PRODUCT_SYNC_QUEUE,
  SCHEDULE_CONNECTED_INVENTORY_JOB,
  SYNC_STORE_INVENTORY_JOB,
  SYNC_STORE_PRODUCTS_JOB,
} from './product-sync.constants';
import type { ProductSyncJobData } from './product-sync.types';
import { ProductSyncSchedulerService } from './product-sync-scheduler.service';
import { ProductSyncWorkerService } from './product-sync-worker.service';

@Processor(PRODUCT_SYNC_QUEUE)
export class ProductSyncProcessor extends WorkerHost {
  constructor(
    private readonly syncWorker: ProductSyncWorkerService,
    private readonly scheduler: ProductSyncSchedulerService,
  ) {
    super();
  }

  async process(job: Job<ProductSyncJobData | Record<string, never>>) {
    if (job.name === SCHEDULE_CONNECTED_INVENTORY_JOB) {
      await this.scheduler.dispatchConnectedInventorySyncs();
      return;
    }

    if (
      job.name !== SYNC_STORE_PRODUCTS_JOB &&
      job.name !== SYNC_STORE_INVENTORY_JOB
    ) {
      throw new Error(`Unsupported product sync job: ${job.name}`);
    }

    const data = job.data as ProductSyncJobData;

    try {
      await this.syncWorker.run(data, async (progress) => {
        await job.updateProgress(progress);
      });
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      const accessBlocked = error instanceof BillingAccessRequiredException;
      if (isFinalAttempt || accessBlocked) {
        await this.syncWorker.markFinalFailure(data, error);
      }

      if (accessBlocked) throw new UnrecoverableError(error.message);
      throw error;
    }
  }
}
