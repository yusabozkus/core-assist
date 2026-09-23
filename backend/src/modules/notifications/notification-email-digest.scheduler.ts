import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import {
  AI_REVIEW_DIGEST_INTERVAL_MS,
  LOW_STOCK_DIGEST_CHECK_INTERVAL_MS,
  NOTIFICATION_EMAIL_DIGEST_QUEUE,
  OUT_OF_STOCK_DIGEST_CHECK_INTERVAL_MS,
  SEND_AI_REVIEW_DIGEST_JOB,
  SEND_LOW_STOCK_DIGEST_JOB,
  SEND_OUT_OF_STOCK_DIGEST_JOB,
} from './notification-email-digest.constants';

@Injectable()
export class NotificationEmailDigestScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(NOTIFICATION_EMAIL_DIGEST_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    const configuredInterval = Number(process.env.AI_REVIEW_DIGEST_INTERVAL_MS);
    const intervalMs =
      Number.isFinite(configuredInterval) && configuredInterval >= 60_000
        ? configuredInterval
        : AI_REVIEW_DIGEST_INTERVAL_MS;

    await this.queue.upsertJobScheduler(
      SEND_AI_REVIEW_DIGEST_JOB,
      { every: intervalMs },
      {
        name: SEND_AI_REVIEW_DIGEST_JOB,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 50,
          removeOnFail: failedJobRetention(100),
        },
      },
    );
    await this.queue.upsertJobScheduler(
      SEND_LOW_STOCK_DIGEST_JOB,
      { every: LOW_STOCK_DIGEST_CHECK_INTERVAL_MS },
      {
        name: SEND_LOW_STOCK_DIGEST_JOB,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 50,
          removeOnFail: failedJobRetention(100),
        },
      },
    );
    await this.queue.upsertJobScheduler(
      SEND_OUT_OF_STOCK_DIGEST_JOB,
      { every: OUT_OF_STOCK_DIGEST_CHECK_INTERVAL_MS },
      {
        name: SEND_OUT_OF_STOCK_DIGEST_JOB,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 50,
          removeOnFail: failedJobRetention(100),
        },
      },
    );
  }
}
