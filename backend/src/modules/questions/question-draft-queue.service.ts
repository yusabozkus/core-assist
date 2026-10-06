import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingUsageService } from '../billing/billing-usage.service';
import {
  BillingAccessRequiredException,
  BillingQuotaExceededException,
} from '../billing/billing.errors';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
  StoreStatus,
} from '../../generated/prisma/enums';
import {
  APPLY_AUTOMATION_SETTINGS_JOB,
  GENERATE_QUESTION_DRAFT_JOB,
  QUESTION_DRAFT_QUEUE,
  RESUME_BILLING_BLOCKED_DRAFTS_JOB,
} from './question-draft.constants';
import type {
  QuestionDraftDispatcher,
  QuestionDraftJobData,
  QuestionDraftQueueJobData,
} from './question-draft.types';
import {
  DraftExecutionService,
  DRAFT_LEASE_MS,
} from './draft-execution.service';

const AUTOMATION_SETTINGS_BATCH_SIZE = 100;
const QUEUED_DRAFT_RECONCILE_GRACE_MS = 60_000;
const PROCESSING_DRAFT_RECONCILE_GRACE_MS = DRAFT_LEASE_MS + 60_000;
const processingRecoverySelect = {
  id: true,
  storeId: true,
  productId: true,
  draftQueuedAt: true,
  draftProcessingStartedAt: true,
  updatedAt: true,
  connection: { select: { status: true } },
  answerDelivery: { select: { status: true } },
  store: {
    select: {
      workspaceId: true,
      status: true,
      knowledgeProfile: { select: { automationMode: true } },
    },
  },
} satisfies Prisma.ProductQuestionSelect;
type ProcessingRecoveryQuestion = Prisma.ProductQuestionGetPayload<{
  select: typeof processingRecoverySelect;
}>;

@Injectable()
export class QuestionDraftQueueService
  implements QuestionDraftDispatcher, OnModuleInit
{
  private readonly logger = new Logger(QuestionDraftQueueService.name);

  constructor(
    @InjectQueue(QUESTION_DRAFT_QUEUE)
    private readonly queue: Queue<QuestionDraftQueueJobData>,
    private readonly prisma: PrismaService,
    private readonly billing: BillingSubscriptionService,
    private readonly billingUsage: BillingUsageService,
    private readonly executions: DraftExecutionService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'resume-billing-blocked-drafts',
      { every: 5 * 60_000 },
      {
        name: RESUME_BILLING_BLOCKED_DRAFTS_JOB,
        opts: { removeOnComplete: true, removeOnFail: failedJobRetention(10) },
      },
    );
  }

  async resumeBillingBlockedDrafts() {
    await this.reconcileProcessingDrafts();
    await this.reconcileQueuedDrafts();
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

  private async reconcileProcessingDrafts() {
    let cursor: string | undefined;
    const staleBefore = new Date(
      Date.now() - PROCESSING_DRAFT_RECONCILE_GRACE_MS,
    );
    do {
      const questions = await this.prisma.productQuestion.findMany({
        where: {
          status: ProductQuestionStatus.PENDING,
          draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
          OR: [
            { draftProcessingStartedAt: { lte: staleBefore } },
            {
              draftProcessingStartedAt: null,
              draftQueuedAt: { lte: staleBefore },
            },
            {
              draftProcessingStartedAt: null,
              draftQueuedAt: null,
              updatedAt: { lte: staleBefore },
            },
          ],
        },
        select: processingRecoverySelect,
        orderBy: { id: 'asc' },
        take: AUTOMATION_SETTINGS_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const question of questions) {
        try {
          const job = await this.queue.getJob(`question-draft-${question.id}`);
          const state = await job?.getState();
          if (
            job &&
            state !== 'failed' &&
            state !== 'completed' &&
            state !== 'unknown'
          )
            continue;
          let blockedError:
            | BillingAccessRequiredException
            | BillingQuotaExceededException
            | undefined;
          if (canRetryProcessingQuestion(question, job?.data)) {
            try {
              await this.billing.assertStoreAccess(question.storeId);
              await this.billingUsage.assertDraftGenerationAvailableForStore(
                question.storeId,
                question.id,
              );
            } catch (error) {
              if (
                !(error instanceof BillingAccessRequiredException) &&
                !(error instanceof BillingQuotaExceededException)
              )
                throw error;
              blockedError = error;
            }
          }
          let retry = false;
          const recovered = await this.executions.recoverAbandonedProcessing(
            question.store.workspaceId,
            question.id,
            async (tx) => {
              const current = await tx.productQuestion.findFirst({
                where: {
                  id: question.id,
                  storeId: question.storeId,
                  status: ProductQuestionStatus.PENDING,
                  draftProcessingStatus:
                    QuestionDraftProcessingStatus.PROCESSING,
                  draftProcessingStartedAt: question.draftProcessingStartedAt,
                  draftQueuedAt: question.draftQueuedAt,
                  updatedAt: question.updatedAt,
                },
                select: processingRecoverySelect,
              });
              if (
                !current ||
                current.store.workspaceId !== question.store.workspaceId
              )
                return false;
              const eligible = canRetryProcessingQuestion(current, job?.data);
              const recoveryBlock = eligible ? blockedError : undefined;
              retry = eligible && !recoveryBlock;
              const updated = await tx.productQuestion.updateMany({
                where: {
                  id: current.id,
                  storeId: current.storeId,
                  status: ProductQuestionStatus.PENDING,
                  draftProcessingStatus:
                    QuestionDraftProcessingStatus.PROCESSING,
                  draftProcessingStartedAt: current.draftProcessingStartedAt,
                  draftQueuedAt: current.draftQueuedAt,
                  updatedAt: current.updatedAt,
                  productId: current.productId,
                  connection: { status: current.connection.status },
                  answerDelivery: current.answerDelivery
                    ? { status: current.answerDelivery.status }
                    : { is: null },
                  store: {
                    workspaceId: current.store.workspaceId,
                    status: current.store.status,
                    knowledgeProfile: current.store.knowledgeProfile
                      ? {
                          automationMode:
                            current.store.knowledgeProfile.automationMode,
                        }
                      : { is: null },
                  },
                },
                data: {
                  draftProcessingStatus:
                    recoveryBlock instanceof BillingQuotaExceededException
                      ? QuestionDraftProcessingStatus.BLOCKED_QUOTA
                      : recoveryBlock instanceof BillingAccessRequiredException
                        ? QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION
                        : retry
                          ? QuestionDraftProcessingStatus.QUEUED
                          : QuestionDraftProcessingStatus.FAILED,
                  draftProcessingStartedAt: null,
                  draftQueuedAt: retry ? new Date() : null,
                  draftProcessingError:
                    recoveryBlock?.message ??
                    (retry
                      ? null
                      : 'Kesintiye uğrayan taslak işi artık otomatik üretime uygun değil. Soruyu, bağlantıyı ve yanıt ayarlarını kontrol edin.'),
                },
              });
              return updated.count === 1;
            },
          );
          if (recovered && retry) {
            await this.dispatchDraftJob({
              ...job?.data,
              storeId: question.storeId,
              questionId: question.id,
            });
          }
        } catch {
          // If Redis dispatch fails after the DB commit, QUEUED remains the
          // durable outbox. One failure must not stop recovery of later rows.
          this.logger.warn(`AI processing recovery failed (${question.id}).`);
        }
      }
      cursor =
        questions.length === AUTOMATION_SETTINGS_BATCH_SIZE
          ? questions[questions.length - 1].id
          : undefined;
    } while (cursor);
  }

  private async reconcileQueuedDrafts() {
    // QUEUED is the durable dispatch record. A retained failed BullMQ job or a
    // crash between the DB update and Redis dispatch must not strand it forever.
    let cursor: string | undefined;
    const staleBefore = new Date(Date.now() - QUEUED_DRAFT_RECONCILE_GRACE_MS);
    do {
      const questions = await this.prisma.productQuestion.findMany({
        where: {
          status: ProductQuestionStatus.PENDING,
          draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
          OR: [
            { draftQueuedAt: null },
            { draftQueuedAt: { lte: staleBefore } },
          ],
          productId: { not: null },
          connection: { status: ChannelConnectionStatus.CONNECTED },
          store: {
            status: StoreStatus.ACTIVE,
          },
        },
        select: {
          id: true,
          storeId: true,
          draftQueuedAt: true,
          store: {
            select: { knowledgeProfile: { select: { automationMode: true } } },
          },
        },
        orderBy: { id: 'asc' },
        take: AUTOMATION_SETTINGS_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const question of questions) {
        try {
          const job = await this.queue.getJob(`question-draft-${question.id}`);
          const state = await job?.getState();
          if (
            job &&
            state !== 'failed' &&
            state !== 'completed' &&
            state !== 'unknown'
          )
            continue;
          if (
            !isAutomaticMode(question.store.knowledgeProfile?.automationMode) &&
            !isKnowledgeRetry(job?.data)
          )
            continue;
          await this.billing.assertStoreAccess(question.storeId);
          await this.billingUsage.assertDraftGenerationAvailableForStore(
            question.storeId,
            question.id,
          );
          await this.dispatchDraftJob({
            ...job?.data,
            storeId: question.storeId,
            questionId: question.id,
          });
        } catch (error) {
          if (
            error instanceof BillingAccessRequiredException ||
            error instanceof BillingQuotaExceededException
          ) {
            await this.prisma.productQuestion.updateMany({
              where: {
                id: question.id,
                storeId: question.storeId,
                status: ProductQuestionStatus.PENDING,
                draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
                draftQueuedAt: question.draftQueuedAt,
              },
              data: {
                draftProcessingStatus:
                  error instanceof BillingQuotaExceededException
                    ? QuestionDraftProcessingStatus.BLOCKED_QUOTA
                    : QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION,
                draftProcessingError: error.message,
                draftQueuedAt: null,
                draftProcessingStartedAt: null,
              },
            });
          } else {
            // Leave the outbox row queued for the next sweep and keep scanning;
            // one Redis failure must not starve later questions.
            this.logger.warn(
              `AI draft queue reconciliation failed (${question.id}).`,
            );
          }
        }
      }
      cursor =
        questions.length === AUTOMATION_SETTINGS_BATCH_SIZE
          ? questions[questions.length - 1].id
          : undefined;
    } while (cursor);
  }

  private async dispatchDraftJob(data: QuestionDraftJobData) {
    const jobId = `question-draft-${data.questionId}`;
    const existing = await this.queue.getJob(jobId);
    const state = await existing?.getState();
    if (existing && (state === 'failed' || state === 'completed')) {
      await existing.updateData({ ...existing.data, ...data });
      try {
        await existing.retry(state, {
          resetAttemptsMade: true,
          resetAttemptsStarted: true,
        });
      } catch (error) {
        // Another worker/reconciler may already have retried the same job.
        const currentState = await existing.getState();
        if (
          currentState === 'failed' ||
          currentState === 'completed' ||
          currentState === 'unknown'
        )
          throw error;
      }
      return;
    }
    if (existing && state === 'unknown') {
      // add() alone does not repair an orphaned job hash with the same ID.
      // remove() respects BullMQ's active-job lock; never force-remove it.
      await existing.remove();
    }
    if (existing && state !== 'unknown') return;
    await this.queue.add(GENERATE_QUESTION_DRAFT_JOB, data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: failedJobRetention(250),
    });
  }

  async scheduleAutomationSettingsApply(storeId: string) {
    await this.queue.add(
      APPLY_AUTOMATION_SETTINGS_JOB,
      { storeId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: failedJobRetention(25),
      },
    );
  }

  async applyAutomationSettings(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, status: StoreStatus.ACTIVE },
      select: {
        knowledgeProfile: { select: { automationMode: true } },
      },
    });
    const automationMode = store?.knowledgeProfile?.automationMode;
    if (
      automationMode !== AiAutomationMode.SHADOW &&
      automationMode !== AiAutomationMode.SAFE_AUTO
    ) {
      return { pendingQueued: 0, readyQueued: 0 };
    }
    if (!(await this.billing.hasStoreAccess(storeId))) {
      return { pendingQueued: 0, readyQueued: 0 };
    }

    const pendingQuestions = await this.prisma.productQuestion.findMany({
      where: {
        storeId,
        status: ProductQuestionStatus.PENDING,
        productId: { not: null },
        connection: { status: ChannelConnectionStatus.CONNECTED },
        draftProcessingStatus: {
          in: [QuestionDraftProcessingStatus.FAILED],
        },
      },
      orderBy: [{ externalCreatedAt: 'asc' }, { id: 'asc' }],
      take: AUTOMATION_SETTINGS_BATCH_SIZE,
      select: { id: true },
    });

    const waitingQuestions =
      pendingQuestions.length < AUTOMATION_SETTINGS_BATCH_SIZE
        ? await this.prisma.productQuestion.findMany({
            where: {
              storeId,
              status: ProductQuestionStatus.PENDING,
              productId: { not: null },
              connection: { status: ChannelConnectionStatus.CONNECTED },
              draftProcessingStatus: null,
            },
            orderBy: [{ externalCreatedAt: 'asc' }, { id: 'asc' }],
            take: AUTOMATION_SETTINGS_BATCH_SIZE - pendingQuestions.length,
            select: { id: true },
          })
        : [];
    const draftCandidates = [...pendingQuestions, ...waitingQuestions];

    for (const question of draftCandidates) {
      await this.enqueue(storeId, question.id, { reason: 'AUTOMATION' });
    }

    const readyQuestions =
      automationMode === AiAutomationMode.SAFE_AUTO
        ? await this.prisma.productQuestion.findMany({
            where: {
              storeId,
              status: ProductQuestionStatus.DRAFTED,
              draftDecision: QuestionReplyDecision.READY_FOR_SEND,
              answer: { not: null },
              connection: { status: ChannelConnectionStatus.CONNECTED },
              draftAttempts: {
                some: {
                  outcome: AiDraftOutcome.AVAILABLE,
                  autoSendEligible: true,
                },
              },
              OR: [
                { answerDelivery: { is: null } },
                {
                  answerDelivery: {
                    is: { status: QuestionAnswerStatus.FAILED },
                  },
                },
              ],
            },
            orderBy: [{ externalCreatedAt: 'asc' }, { id: 'asc' }],
            take: AUTOMATION_SETTINGS_BATCH_SIZE,
            select: {
              id: true,
              draftAttempts: {
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: 1,
                select: { autoSendEligible: true },
              },
            },
          })
        : [];
    const eligibleReadyQuestions = readyQuestions.filter(
      (question) => question.draftAttempts[0]?.autoSendEligible,
    );

    for (const question of eligibleReadyQuestions) {
      await this.dispatchDraftJob({
        storeId,
        questionId: question.id,
        reason: 'AUTOMATION',
      });
    }

    if (
      draftCandidates.length === AUTOMATION_SETTINGS_BATCH_SIZE ||
      eligibleReadyQuestions.length === AUTOMATION_SETTINGS_BATCH_SIZE
    ) {
      await this.queue.add(
        APPLY_AUTOMATION_SETTINGS_JOB,
        { storeId },
        {
          delay: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: true,
          removeOnFail: failedJobRetention(25),
        },
      );
    }

    return {
      pendingQueued: draftCandidates.length,
      readyQueued: eligibleReadyQuestions.length,
    };
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
          store: { status: StoreStatus.ACTIVE },
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
        store: { status: StoreStatus.ACTIVE },
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
      await this.dispatchDraftJob({ storeId, questionId, ...options });
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

function isAutomaticMode(mode: AiAutomationMode | null | undefined) {
  return (
    mode === AiAutomationMode.SHADOW || mode === AiAutomationMode.SAFE_AUTO
  );
}

function canRetryProcessingQuestion(
  question: ProcessingRecoveryQuestion,
  job?: QuestionDraftQueueJobData,
) {
  return Boolean(
    question.productId &&
    question.store.status === StoreStatus.ACTIVE &&
    question.connection.status === ChannelConnectionStatus.CONNECTED &&
    (!question.answerDelivery ||
      question.answerDelivery.status === QuestionAnswerStatus.FAILED) &&
    (isAutomaticMode(question.store.knowledgeProfile?.automationMode) ||
      isKnowledgeRetry(job)),
  );
}

function isKnowledgeRetry(data?: QuestionDraftQueueJobData) {
  return data && 'reason' in data && data.reason === 'KNOWLEDGE_RESOLVED';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : String(error);
}
