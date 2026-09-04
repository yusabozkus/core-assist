import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
} from './question-draft.constants';
import type { QuestionDraftJobData } from './question-draft.types';
import { QuestionDraftWorkerService } from './question-draft-worker.service';

@Processor(QUESTION_DRAFT_QUEUE, { concurrency: 1 })
export class QuestionDraftProcessor extends WorkerHost {
  constructor(private readonly draftWorker: QuestionDraftWorkerService) {
    super();
  }

  async process(job: Job<QuestionDraftJobData>) {
    if (job.name !== GENERATE_QUESTION_DRAFT_JOB) {
      throw new Error(`Unsupported question draft job: ${job.name}`);
    }

    try {
      return await this.draftWorker.run(job.data);
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      if (isFinalAttempt) {
        await this.draftWorker.markFinalFailure(job.data, error);
      }

      throw error;
    }
  }
}
