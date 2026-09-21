import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  CHECK_SUPPORT_SLA_JOB,
  SUPPORT_NOTIFICATION_QUEUE,
} from './support-notification.constants';
import { SupportNotificationService } from './support-notification.service';

@Processor(SUPPORT_NOTIFICATION_QUEUE, { concurrency: 1 })
export class SupportNotificationProcessor extends WorkerHost {
  constructor(private readonly notifications: SupportNotificationService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== CHECK_SUPPORT_SLA_JOB) return;
    await this.notifications.notifyOverdueTickets();
  }
}
