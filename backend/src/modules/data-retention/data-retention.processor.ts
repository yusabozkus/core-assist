import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { SupportAttachmentService } from '../support/support-attachment.service';
import {
  DATA_RETENTION_QUEUE,
  DATA_RETENTION_SCHEDULER_ID,
  RUN_DATA_RETENTION,
  RUN_SUPPORT_IMAGE_CLEANUP,
  SUPPORT_IMAGE_CLEANUP_SCHEDULER_ID,
} from './data-retention.constants';
import { resolveDataRetentionPolicy } from './data-retention.policy';
import { DataRetentionService } from './data-retention.service';

@Processor(DATA_RETENTION_QUEUE, { concurrency: 1 })
export class DataRetentionProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    @InjectQueue(DATA_RETENTION_QUEUE) private readonly queue: Queue,
    private readonly retention: DataRetentionService,
    private readonly attachments: SupportAttachmentService,
  ) {
    super();
  }

  async onModuleInit() {
    const policy = resolveDataRetentionPolicy();
    await this.queue.upsertJobScheduler(
      DATA_RETENTION_SCHEDULER_ID,
      { every: policy.cleanupIntervalMs },
      {
        name: RUN_DATA_RETENTION,
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: failedJobRetention(25),
        },
      },
    );
    await this.queue.upsertJobScheduler(
      SUPPORT_IMAGE_CLEANUP_SCHEDULER_ID,
      { every: 60_000 },
      {
        name: RUN_SUPPORT_IMAGE_CLEANUP,
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: failedJobRetention(25),
        },
      },
    );
  }

  async process(job: Job) {
    if (job.name === RUN_SUPPORT_IMAGE_CLEANUP) {
      return this.attachments.cleanupPendingObjects();
    }
    if (job.name !== RUN_DATA_RETENTION) {
      throw new Error('Unsupported data retention job');
    }
    return this.retention.cleanup();
  }
}
