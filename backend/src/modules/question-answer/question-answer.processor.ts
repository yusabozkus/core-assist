import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  QUESTION_ANSWER_QUEUE,
  SEND_QUESTION_ANSWER_JOB,
} from './question-answer.constants';
import type { QuestionAnswerJobData } from './question-answer.types';
import { QuestionAnswerWorkerService } from './question-answer-worker.service';

@Processor(QUESTION_ANSWER_QUEUE)
export class QuestionAnswerProcessor extends WorkerHost {
  constructor(private readonly answerWorker: QuestionAnswerWorkerService) {
    super();
  }

  async process(job: Job<QuestionAnswerJobData>) {
    if (job.name !== SEND_QUESTION_ANSWER_JOB) {
      throw new Error(`Unsupported question answer job: ${job.name}`);
    }

    try {
      await this.answerWorker.run(job.data);
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;

      if (isFinalAttempt) {
        await this.answerWorker.markFinalFailure(job.data, error);
      }

      throw error;
    }
  }
}
