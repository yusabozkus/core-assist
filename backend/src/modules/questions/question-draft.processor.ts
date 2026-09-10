import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import {
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
  RESUME_BILLING_BLOCKED_DRAFTS_JOB,
} from './question-draft.constants';
import type { QuestionDraftJobData } from './question-draft.types';
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

  async process(job: Job<QuestionDraftJobData>) {
    if (job.name === RESUME_BILLING_BLOCKED_DRAFTS_JOB)
      return this.draftQueue.resumeBillingBlockedDrafts();
    if (job.name !== GENERATE_QUESTION_DRAFT_JOB) {
      throw new Error(`Unsupported question draft job: ${job.name}`);
    }

    try {
      return await this.draftWorker.run(job.data);
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      const billingBlocked =
        error instanceof BillingAccessRequiredException ||
        error instanceof BillingQuotaExceededException;
      if (isFinalAttempt || billingBlocked) {
        await this.draftWorker.markFinalFailure(job.data, error);
      }

      if (billingBlocked) throw new UnrecoverableError(error.message);
      throw error;
    }
  }
}
