import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
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
    @InjectQueue(PRODUCT_SYNC_QUEUE)
    private readonly queue: Queue<ProductSyncJobData>,
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
      const result = await this.syncWorker.run(data, async (progress) => {
        await job.updateProgress(progress);
      });
      if (result.continuationBatch !== null) {
        await this.enqueueContinuation(
          job.name,
          data,
          result.continuationBatch,
        );
      }
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

  private async enqueueContinuation(
    jobName: string,
    data: ProductSyncJobData,
    checkpointBatch: number,
  ) {
    await this.queue.add(
      jobName,
      { ...data, checkpointBatch },
      {
        jobId: `sync-${data.connectionId}-${data.syncRunId}-checkpoint-${checkpointBatch}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: failedJobRetention(250),
      },
    );
  }
}
