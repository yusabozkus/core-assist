import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  PRODUCT_SYNC_QUEUE,
  SYNC_STORE_PRODUCTS_JOB,
} from './product-sync.constants';
import type { ProductSyncJobData } from './product-sync.types';
import { ProductSyncWorkerService } from './product-sync-worker.service';

@Processor(PRODUCT_SYNC_QUEUE)
export class ProductSyncProcessor extends WorkerHost {
  constructor(private readonly syncWorker: ProductSyncWorkerService) {
    super();
  }

  async process(job: Job<ProductSyncJobData>): Promise<void> {
    if (job.name !== SYNC_STORE_PRODUCTS_JOB) {
      throw new Error(`Unsupported product sync job: ${job.name}`);
    }

    try {
      await this.syncWorker.run(job.data, async (progress) => {
        await job.updateProgress(progress);
      });
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      if (isFinalAttempt) {
        await this.syncWorker.markFinalFailure(job.data, error);
      }

      throw error;
    }
  }
}
