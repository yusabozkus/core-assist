import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import type { Queue } from 'bullmq';
import {
  PADDLE_WEBHOOK_QUEUE,
  PROCESS_PADDLE_WEBHOOK_JOB,
} from './paddle-webhook.constants';

export type PaddleWebhookJobData = {
  event: EventEntity;
};

const ENQUEUE_DEADLINE_MS = 3_500;
const DAY_IN_SECONDS = 24 * 60 * 60;

@Injectable()
export class PaddleWebhookQueueService {
  constructor(
    @InjectQueue(PADDLE_WEBHOOK_QUEUE)
    private readonly queue: Queue<PaddleWebhookJobData>,
  ) {}

  async enqueue(event: EventEntity) {
    try {
      await this.addWithDeadline(event);
    } catch (error) {
      // A failed acknowledgement is intentional here: Paddle can retry the
      // delivery, while the event ID keeps a late queue write idempotent.
      throw new ServiceUnavailableException(
        'Paddle webhook kuyruğuna şu anda ulaşılamıyor.',
        { cause: error },
      );
    }

    return { received: true, queued: true };
  }

  private async addWithDeadline(event: EventEntity) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Paddle webhook enqueue deadline exceeded.')),
        ENQUEUE_DEADLINE_MS,
      );
    });

    try {
      await Promise.race([this.addOrRetryFailedJob(event), deadline]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async addOrRetryFailedJob(event: EventEntity) {
    const job = await this.queue.add(
      PROCESS_PADDLE_WEBHOOK_JOB,
      { event },
      {
        jobId: `paddle-webhook-${event.eventId}`,
        attempts: 10,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: DAY_IN_SECONDS, count: 5_000 },
        removeOnFail: { age: 7 * DAY_IN_SECONDS, count: 5_000 },
      },
    );

    if ((await job.getState()) !== 'failed') return;

    try {
      // A Paddle redelivery can revive an exhausted job after the underlying
      // mapping or infrastructure problem has been fixed.
      await job.retry('failed');
    } catch (error) {
      // Another delivery may have retried the same event concurrently.
      if ((await job.getState()) === 'failed') throw error;
    }
  }
}
