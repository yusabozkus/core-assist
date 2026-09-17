import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PaddleBillingService } from './paddle-billing.service';
import {
  PADDLE_WEBHOOK_QUEUE,
  PROCESS_PADDLE_WEBHOOK_JOB,
} from './paddle-webhook.constants';
import type { PaddleWebhookJobData } from './paddle-webhook-queue.service';
import { LoggingContext } from '../../infrastructure/logging/logging-context';

@Processor(PADDLE_WEBHOOK_QUEUE, { concurrency: 1 })
export class PaddleWebhookProcessor extends WorkerHost {
  constructor(private readonly paddleBilling: PaddleBillingService) {
    super();
  }

  async process(job: Job<PaddleWebhookJobData>) {
    if (job.name !== PROCESS_PADDLE_WEBHOOK_JOB) {
      throw new Error(`Unsupported Paddle webhook job: ${job.name}`);
    }

    return LoggingContext.run(
      {
        requestId: job.data.correlationId,
        ...(job.id === undefined ? {} : { jobId: String(job.id) }),
        queue: PADDLE_WEBHOOK_QUEUE,
      },
      () => this.paddleBilling.processVerifiedWebhook(job.data.event),
    );
  }
}
