import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import {
  CHECK_SUPPORT_SLA_JOB,
  DEFAULT_SUPPORT_SLA_CHECK_INTERVAL_MS,
  SUPPORT_NOTIFICATION_QUEUE,
} from './support-notification.constants';

@Injectable()
export class SupportNotificationScheduler implements OnModuleInit {
  private readonly logger = new Logger(SupportNotificationScheduler.name);

  constructor(
    @InjectQueue(SUPPORT_NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    const intervalMs = parseInterval(
      process.env.SUPPORT_SLA_CHECK_INTERVAL_MS,
      DEFAULT_SUPPORT_SLA_CHECK_INTERVAL_MS,
    );

    await this.queue.upsertJobScheduler(
      CHECK_SUPPORT_SLA_JOB,
      { every: intervalMs },
      {
        name: CHECK_SUPPORT_SLA_JOB,
        opts: {
          removeOnComplete: 50,
          removeOnFail: failedJobRetention(100),
        },
      },
    );
    this.logger.log(
      `Destek SLA kontrolü ${Math.round(intervalMs / 1_000)} saniyede bir çalışacak.`,
    );
  }
}

function parseInterval(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : fallback;
}
