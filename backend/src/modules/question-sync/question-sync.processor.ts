import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import {
  QUESTION_SYNC_QUEUE,
  SCHEDULE_CONNECTED_QUESTIONS_JOB,
  SYNC_STORE_QUESTIONS_JOB,
} from './question-sync.constants';
import type { QuestionSyncJobData } from './question-sync.types';
import { QuestionSyncSchedulerService } from './question-sync-scheduler.service';
import { QuestionSyncWorkerService } from './question-sync-worker.service';

@Processor(QUESTION_SYNC_QUEUE)
export class QuestionSyncProcessor extends WorkerHost {
  constructor(
    private readonly syncWorker: QuestionSyncWorkerService,
    private readonly scheduler: QuestionSyncSchedulerService,
  ) {
    super();
  }

  async process(job: Job<QuestionSyncJobData | Record<string, never>>) {
    if (job.name === SCHEDULE_CONNECTED_QUESTIONS_JOB) {
      await this.scheduler.dispatchConnectedQuestionSyncs();
      return;
    }

    if (job.name !== SYNC_STORE_QUESTIONS_JOB) {
      throw new Error(`Unsupported question sync job: ${job.name}`);
    }

    const data = job.data as QuestionSyncJobData;

    try {
      await this.syncWorker.run(data);
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      const accessBlocked = error instanceof BillingAccessRequiredException;
      if (isFinalAttempt || accessBlocked) {
        await this.syncWorker.markFinalFailure(data, error);
      }

      if (accessBlocked) throw new UnrecoverableError(error.message);
      throw error;
    }
  }
}
