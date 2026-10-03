import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DelayedError, UnrecoverableError } from 'bullmq';
import {
  DraftCapacityException,
  DRAFT_COOLDOWN_MS,
} from './draft-execution.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import {
  APPLY_AUTOMATION_SETTINGS_JOB,
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
  RESUME_BILLING_BLOCKED_DRAFTS_JOB,
} from './question-draft.constants';
import type {
  QuestionDraftJobData,
  QuestionDraftQueueJobData,
} from './question-draft.types';
import { QuestionDraftWorkerService } from './question-draft-worker.service';
import { QuestionDraftQueueService } from './question-draft-queue.service';

@Processor(QUESTION_DRAFT_QUEUE, { concurrency: 1 })
export class QuestionDraftProcessor extends WorkerHost {
  constructor(
    private readonly draftWorker: QuestionDraftWorkerService,
    private readonly draftQueue: QuestionDraftQueueService,
  ) {
    super();
  }

  async process(job: Job<QuestionDraftQueueJobData>, token?: string) {
    if (job.name === RESUME_BILLING_BLOCKED_DRAFTS_JOB)
      return this.draftQueue.resumeBillingBlockedDrafts();
    if (job.name === APPLY_AUTOMATION_SETTINGS_JOB)
      return this.draftQueue.applyAutomationSettings(job.data.storeId);
    if (job.name !== GENERATE_QUESTION_DRAFT_JOB) {
      throw new Error(`Unsupported question draft job: ${job.name}`);
    }

    const data = job.data as QuestionDraftJobData;

    try {
      return await this.draftWorker.run(data);
    } catch (error) {
      if (error instanceof DraftCapacityException) {
        await this.draftWorker.deferForCapacity(data);
        await job.moveToDelayed(Date.now() + DRAFT_COOLDOWN_MS, token);
        throw new DelayedError();
      }
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      const billingBlocked =
        error instanceof BillingAccessRequiredException ||
        error instanceof BillingQuotaExceededException;
      if (isFinalAttempt || billingBlocked) {
        await this.draftWorker.markFinalFailure(data, error);
      }

      if (billingBlocked) throw new UnrecoverableError(error.message);
      throw error;
    }
  }
}
