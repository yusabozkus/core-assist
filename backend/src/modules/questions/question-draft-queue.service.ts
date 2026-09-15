import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingUsageService } from '../billing/billing-usage.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import {
  ProductQuestionStatus,
  QuestionDraftProcessingStatus,
} from '../../generated/prisma/enums';
import {
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
  RESUME_BILLING_BLOCKED_DRAFTS_JOB,
} from './question-draft.constants';
import type {
  QuestionDraftDispatcher,
  QuestionDraftJobData,
} from './question-draft.types';

@Injectable()
export class QuestionDraftQueueService
  implements QuestionDraftDispatcher, OnModuleInit
{
  constructor(
    @InjectQueue(QUESTION_DRAFT_QUEUE)
    private readonly queue: Queue<QuestionDraftJobData>,
    private readonly prisma: PrismaService,
    private readonly billing: BillingSubscriptionService,
    private readonly billingUsage: BillingUsageService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'resume-billing-blocked-drafts',
      { every: 5 * 60_000 },
      {
        name: RESUME_BILLING_BLOCKED_DRAFTS_JOB,
        opts: { removeOnComplete: true, removeOnFail: { count: 10 } },
      },
    );
  }

  async resumeBillingBlockedDrafts() {
    // No marketplace fetch and no model call. Retry eligibility only; normal
    // worker checks still protect against quota/access races before generation.
    const stores = await this.prisma.store.findMany({
      where: {
        status: 'ACTIVE',
        knowledgeProfile: { automationMode: { in: ['SHADOW', 'SAFE_AUTO'] } },
        productQuestions: {
          some: {
            status: 'PENDING',
            draftProcessingStatus: {
              in: ['BLOCKED_QUOTA', 'BLOCKED_SUBSCRIPTION'],
            },
          },
        },
      },
      select: { id: true, workspaceId: true },
    });
    for (const store of stores) {
      if (!(await this.billing.hasStoreAccess(store.id))) continue;
      const usage = await this.billingUsage.getCurrentForWorkspace(
        store.workspaceId,
      );
      if (usage.remaining === 0) continue;
      const questions = await this.prisma.productQuestion.findMany({
        where: {
          storeId: store.id,
          status: 'PENDING',
          productId: { not: null },
          connection: { status: 'CONNECTED' },
          draftProcessingStatus: {
            in: ['BLOCKED_QUOTA', 'BLOCKED_SUBSCRIPTION'],
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: Math.min(100, usage.remaining),
        select: { id: true },
      });
      for (const question of questions)
        await this.enqueue(store.id, question.id);
    }
  }

  async enqueue(
    storeId: string,
    questionId: string,
    options: Pick<QuestionDraftJobData, 'reason' | 'requestedByUserId'> = {},
  ) {
    // A stopped subscription or quota is not a transient queue/AI failure.
    // Keep questions syncable without repeatedly scheduling impossible drafts.
    try {
      await this.billing.assertStoreAccess(storeId);
      await this.billingUsage.assertDraftGenerationAvailableForStore(
        storeId,
        questionId,
      );
    } catch (error) {
      if (
        !(error instanceof BillingAccessRequiredException) &&
        !(error instanceof BillingQuotaExceededException)
      )
        throw error;
      const blockedStatus =
        error instanceof BillingQuotaExceededException
          ? QuestionDraftProcessingStatus.BLOCKED_QUOTA
          : QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION;
      await this.prisma.productQuestion.updateMany({
        where: {
          id: questionId,
          storeId,
          status: ProductQuestionStatus.PENDING,
          OR: [
            { draftProcessingStatus: null },
            { draftProcessingStatus: QuestionDraftProcessingStatus.FAILED },
            {
              draftProcessingStatus:
                blockedStatus === QuestionDraftProcessingStatus.BLOCKED_QUOTA
                  ? QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION
                  : QuestionDraftProcessingStatus.BLOCKED_QUOTA,
            },
          ],
        },
        data: {
          draftProcessingStatus: blockedStatus,
          draftProcessingError: error.message,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });
      return;
    }
    const queuedAt = new Date();
    const marked = await this.prisma.productQuestion.updateMany({
      where: {
        id: questionId,
        storeId,
        status: ProductQuestionStatus.PENDING,
        OR: [
          { draftProcessingStatus: null },
          { draftProcessingStatus: QuestionDraftProcessingStatus.FAILED },
          {
            draftProcessingStatus: {
              in: [
                QuestionDraftProcessingStatus.BLOCKED_QUOTA,
                QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION,
              ],
            },
          },
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
        { storeId, questionId, ...options },
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
