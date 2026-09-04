import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import {
  ProductQuestionStatus,
  QuestionDraftProcessingStatus,
} from '../../generated/prisma/enums';
import {
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
} from './question-draft.constants';
import type {
  QuestionDraftDispatcher,
  QuestionDraftJobData,
} from './question-draft.types';

@Injectable()
export class QuestionDraftQueueService implements QuestionDraftDispatcher {
  constructor(
    @InjectQueue(QUESTION_DRAFT_QUEUE)
    private readonly queue: Queue<QuestionDraftJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(storeId: string, questionId: string) {
    const queuedAt = new Date();
    const marked = await this.prisma.productQuestion.updateMany({
      where: {
        id: questionId,
        storeId,
        status: ProductQuestionStatus.PENDING,
        OR: [
          { draftProcessingStatus: null },
          { draftProcessingStatus: QuestionDraftProcessingStatus.FAILED },
        ],
      },
      data: {
        draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
        draftProcessingError: null,
        draftQueuedAt: queuedAt,
        draftProcessingStartedAt: null,
      },
    });

    if (marked.count !== 1) return;

    try {
      await this.queue.add(
        GENERATE_QUESTION_DRAFT_JOB,
        { storeId, questionId },
        {
          jobId: `question-draft-${questionId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (error) {
      await this.prisma.productQuestion.updateMany({
        where: {
          id: questionId,
          storeId,
          status: ProductQuestionStatus.PENDING,
          draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
        },
        data: {
          draftProcessingStatus: QuestionDraftProcessingStatus.FAILED,
          draftProcessingError: errorMessage(error),
        },
      });

      throw new ServiceUnavailableException(
        'AI taslak işi şu anda kuyruğa alınamadı.',
      );
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : String(error);
}
