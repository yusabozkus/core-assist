import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  NOTIFICATION_EMAIL_DIGEST_QUEUE,
  SEND_AI_REVIEW_DIGEST_JOB,
  SEND_LOW_STOCK_DIGEST_JOB,
  SEND_OPERATIONAL_INCIDENT_EMAIL_JOB,
  SEND_OUT_OF_STOCK_DIGEST_JOB,
  SEND_SYNC_INCIDENT_EMAIL_JOB,
  SWEEP_SYNC_INCIDENT_EMAILS_JOB,
  SWEEP_OPERATIONAL_INCIDENT_EMAILS_JOB,
  SWEEP_EMAIL_DELIVERIES_JOB,
} from './notification-email-digest.constants';
import { StockEmailAlertLevel } from '../../generated/prisma/enums';
import { NotificationEmailDigestService } from './notification-email-digest.service';
import { SyncEmailIncidentService } from './sync-email-incident.service';
import { OperationalEmailIncidentService } from './operational-email-incident.service';
import { ResendEmailService } from './resend-email.service';

@Processor(NOTIFICATION_EMAIL_DIGEST_QUEUE, { concurrency: 1 })
export class NotificationEmailDigestProcessor extends WorkerHost {
  constructor(
    private readonly digests: NotificationEmailDigestService,
    private readonly syncIncidents: SyncEmailIncidentService,
    private readonly operationalIncidents: OperationalEmailIncidentService,
    private readonly resend: ResendEmailService,
  ) {
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
    if (job.name === SEND_SYNC_INCIDENT_EMAIL_JOB) {
      const incidentId = (job.data as { incidentId?: unknown }).incidentId;
      if (typeof incidentId !== 'string')
        throw new Error('Sync incident ID is required.');
      await this.syncIncidents.processIncident(incidentId);
      return;
    }
    if (job.name === SWEEP_SYNC_INCIDENT_EMAILS_JOB) {
      await this.syncIncidents.processDue();
      return;
    }
    if (job.name === SEND_OPERATIONAL_INCIDENT_EMAIL_JOB) {
      const incidentId = (job.data as { incidentId?: unknown }).incidentId;
      if (typeof incidentId !== 'string')
        throw new Error('Operational incident ID is required.');
      await this.operationalIncidents.processIncident(incidentId);
      return;
    }
    if (job.name === SWEEP_OPERATIONAL_INCIDENT_EMAILS_JOB) {
      await this.operationalIncidents.processDue();
      return;
    }
    if (job.name === SWEEP_EMAIL_DELIVERIES_JOB) {
      await this.resend.sweepDue();
      return;
    }
    throw new Error(`Unsupported email digest job: ${job.name}`);
  }
}
