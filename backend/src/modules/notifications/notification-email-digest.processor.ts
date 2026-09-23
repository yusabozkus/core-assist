import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  NOTIFICATION_EMAIL_DIGEST_QUEUE,
  SEND_AI_REVIEW_DIGEST_JOB,
  SEND_LOW_STOCK_DIGEST_JOB,
  SEND_OUT_OF_STOCK_DIGEST_JOB,
} from './notification-email-digest.constants';
import { StockEmailAlertLevel } from '../../generated/prisma/enums';
import { NotificationEmailDigestService } from './notification-email-digest.service';

@Processor(NOTIFICATION_EMAIL_DIGEST_QUEUE, { concurrency: 1 })
export class NotificationEmailDigestProcessor extends WorkerHost {
  constructor(private readonly digests: NotificationEmailDigestService) {
    super();
  }

  async process(job: Job) {
    if (job.name === SEND_AI_REVIEW_DIGEST_JOB) {
      await this.digests.sendAiReviewDigests();
      return;
    }
    if (job.name === SEND_LOW_STOCK_DIGEST_JOB) {
      await this.digests.sendStockDigests(StockEmailAlertLevel.LOW_STOCK);
      return;
    }
    if (job.name === SEND_OUT_OF_STOCK_DIGEST_JOB) {
      await this.digests.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
      return;
    }
    throw new Error(`Unsupported email digest job: ${job.name}`);
  }
}
