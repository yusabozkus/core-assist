import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  ProductQuestionStatus,
  QuestionAnswerComposition,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BILLING_AUTOMATION_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import {
  QUESTION_ANSWER_QUEUE,
  RECONCILE_QUESTION_ANSWERS_JOB,
  ANSWER_RECONCILE_INTERVAL_MS,
  ANSWER_PROCESSING_TIMEOUT_MS,
  ANSWER_DELIVERY_REVIEW_MESSAGE,
  SEND_QUESTION_ANSWER_JOB,
} from './question-answer.constants';
import type {
  QueuedQuestionAnswer,
  QuestionAnswerDispatcher,
  QuestionAnswerJobData,
  QueueQuestionAnswerInput,
} from './question-answer.types';
import { requiresInventoryVerification } from './automatic-answer-inventory.guard';

@Injectable()
export class QuestionAnswerQueueService
  implements QuestionAnswerDispatcher, OnModuleInit
{
  private readonly logger = new Logger(QuestionAnswerQueueService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    @InjectQueue(QUESTION_ANSWER_QUEUE)
    private readonly queue: Queue<QuestionAnswerJobData>,
    private readonly billing: BillingSubscriptionService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'question-answer-reconciliation',
      { every: ANSWER_RECONCILE_INTERVAL_MS },
      {
        name: RECONCILE_QUESTION_ANSWERS_JOB,
        data: { storeId: '', answerId: '' },
        opts: { removeOnComplete: true, removeOnFail: failedJobRetention(25) },
      },
    );
  }

  async reconcile() {
    // PROCESSING is the durable boundary before the external POST. Never reset
    // it to QUEUED: the marketplace might already have accepted the answer.
    await this.prisma.questionAnswer.updateMany({
      where: {
        status: QuestionAnswerStatus.PROCESSING,
        OR: [
          {
            processingStartedAt: {
              lt: new Date(Date.now() - ANSWER_PROCESSING_TIMEOUT_MS),
            },
          },
          {
            processingStartedAt: null,
            updatedAt: {
              lt: new Date(Date.now() - ANSWER_PROCESSING_TIMEOUT_MS),
            },
          },
        ],
      },
      data: {
        status: QuestionAnswerStatus.REVIEW_REQUIRED,
        lastError: ANSWER_DELIVERY_REVIEW_MESSAGE,
      },
    });
    // The delivery row is the outbox; its status changes only when claimed by
    // the worker. Cursor pagination prevents a stuck first page starving others.
    let cursor: string | undefined;
    let failed = 0;
    do {
      const rows = await this.prisma.questionAnswer.findMany({
        where: { status: QuestionAnswerStatus.QUEUED },
        select: { id: true, storeId: true, queuedAt: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const row of rows) {
        try {
          const job = await this.queue.getJob(this.jobId(row.id, row.queuedAt));
          const state = await job?.getState();
          if (state === 'failed') await job!.retry('failed');
          else if (!job || state === 'completed') {
            if (job) await job.remove();
            await this.dispatch(row.storeId, row.id, row.queuedAt);
          }
        } catch {
          // A concurrent reconciler may remove/retry this job. Do not let one
          // such race permanently starve later deliveries in the scan.
          failed += 1;
        }
      }
      cursor = rows.length === 100 ? rows[rows.length - 1].id : undefined;
    } while (cursor);
    if (failed)
      throw new Error(
        `${failed} answer deliveries await queue reconciliation.`,
      );
  }

  private jobId(answerId: string, queuedAt: Date) {
    return `question-answer-${answerId}-${queuedAt.getTime()}`;
  }

  private dispatch(storeId: string, answerId: string, queuedAt: Date) {
    return this.queue.add(
      SEND_QUESTION_ANSWER_JOB,
      { storeId, answerId, queuedAt: queuedAt.toISOString() },
      {
        jobId: this.jobId(answerId, queuedAt),
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { count: 250 },
        removeOnFail: failedJobRetention(500),
      },
    );
  }

  async enqueue(
    input: QueueQuestionAnswerInput,
  ): Promise<QueuedQuestionAnswer> {
    const origin =
      input.origin === 'AUTOMATION'
        ? QuestionAnswerOrigin.AUTOMATION
        : QuestionAnswerOrigin.MANUAL;
    if (origin === QuestionAnswerOrigin.AUTOMATION)
      await this.billing.assertStoreAccess(
        input.storeId,
        BILLING_AUTOMATION_STOPPED_MESSAGE,
      );
    // Human-initiated replies to existing questions remain available, including
    // sending a previously prepared draft. Never use composition as the origin.
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: input.questionId, storeId: input.storeId },
      select: {
        id: true,
        status: true,
        answer: true,
        draftDecision: true,
        draftRisks: true,
        draftMissingInformation: true,
        draftEvidenceIds: true,
        draftAttempts: {
          orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
          take: 1,
          select: {
            id: true,
            answer: true,
            answerability: true,
            autoSendEligible: true,
            inventorySnapshotHash: true,
            requestedFacts: true,
            detectedFacts: true,
          },
        },
        connectionId: true,
        store: {
          select: {
            knowledgeProfile: { select: { automationMode: true } },
          },
        },
        connection: {
          select: {
            providerKey: true,
            status: true,
            credentialsEncrypted: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Ürün sorusu bulunamadı.');
    }

    if (question.status === ProductQuestionStatus.ANSWERED) {
      throw new ConflictException('Bu ürün sorusu daha önce yanıtlandı.');
    }

    if (question.status === ProductQuestionStatus.IGNORED) {
      throw new ConflictException('Yoksayılan ürün sorusu yanıtlanamaz.');
    }

    const latestDraftAttempt = question.draftAttempts[0] ?? null;

    if (
      input.draftAttemptId &&
      input.draftAttemptId !== latestDraftAttempt?.id
    ) {
      throw new ConflictException(
        'Seçilen AI taslağı artık bu sorunun güncel taslağı değil.',
      );
    }

    if (
      origin === QuestionAnswerOrigin.AUTOMATION &&
      (question.status !== ProductQuestionStatus.DRAFTED ||
        !latestDraftAttempt ||
        !latestDraftAttempt.autoSendEligible ||
        input.draftAttemptId !== latestDraftAttempt.id ||
        question.answer !== input.answer ||
        question.draftDecision !== QuestionReplyDecision.READY_FOR_SEND ||
        !isEmptyList(question.draftRisks) ||
        !isEmptyList(question.draftMissingInformation) ||
        (latestDraftAttempt.answerability !== 'OUT_OF_SCOPE' &&
          !isNonEmptyList(question.draftEvidenceIds)) ||
        (latestDraftAttempt.answerability !== 'OUT_OF_SCOPE' &&
          requiresInventoryVerification({
            evidenceIds: question.draftEvidenceIds,
            requestedFacts: latestDraftAttempt.requestedFacts,
            detectedFacts: latestDraftAttempt.detectedFacts,
          }) &&
          !latestDraftAttempt.inventorySnapshotHash) ||
        question.store.knowledgeProfile?.automationMode !==
          AiAutomationMode.SAFE_AUTO)
    ) {
      throw new ConflictException(
        'Bu taslak güvenli otomatik gönderim koşullarını karşılamıyor.',
      );
    }

    if (
      question.connection.status !== ChannelConnectionStatus.CONNECTED ||
      !question.connection.credentialsEncrypted
    ) {
      throw new ConflictException(
        'Soruyu yanıtlamak için pazaryeri bağlantısı aktif olmalıdır.',
      );
    }

    if (
      !this.providers.supportsProductQuestions(question.connection.providerKey)
    ) {
      throw new ConflictException(
        'Bu bağlantı için ürün sorusu yanıtlama desteklenmiyor.',
      );
    }

    let queuedAt = new Date();
    const selectedDraftAttempt =
      question.status === ProductQuestionStatus.DRAFTED
        ? latestDraftAttempt
        : null;
    const composition = resolveAnswerComposition(
      input.answer,
      selectedDraftAttempt?.answer ?? null,
      origin,
    );
    const existing = await this.prisma.questionAnswer.findUnique({
      where: { questionId: question.id },
      select: { id: true, status: true, queuedAt: true },
    });
    let answerId: string;

    if (existing) {
      queuedAt = new Date(
        Math.max(queuedAt.getTime(), existing.queuedAt.getTime() + 1),
      );
      if (existing.status === QuestionAnswerStatus.REVIEW_REQUIRED) {
        throw new ConflictException(ANSWER_DELIVERY_REVIEW_MESSAGE);
      }
      if (existing.status === QuestionAnswerStatus.SENT) {
        throw new ConflictException('Bu ürün sorusu daha önce yanıtlandı.');
      }

      if (
        existing.status === QuestionAnswerStatus.QUEUED ||
        existing.status === QuestionAnswerStatus.PROCESSING
      ) {
        throw new ConflictException('Bu cevap zaten gönderim kuyruğunda.');
      }

      const updated = await this.prisma.$transaction(async (transaction) => {
        await this.ensureStoreAcceptsAnswers(transaction, input.storeId);

        const deliveryUpdate = await transaction.questionAnswer.updateMany({
          where: {
            id: existing.id,
            status: QuestionAnswerStatus.FAILED,
            queuedAt: existing.queuedAt,
          },
          data: {
            answer: input.answer,
            requestedByUserId: input.requestedByUserId ?? null,
            draftAttemptId: selectedDraftAttempt?.id ?? null,
            origin,
            composition,
            status: QuestionAnswerStatus.QUEUED,
            lastError: null,
            queuedAt,
            processingStartedAt: null,
          },
        });
        if (deliveryUpdate.count !== 1) {
          throw new ConflictException('Cevabın gönderim durumu değişti.');
        }
        if (selectedDraftAttempt) {
          await transaction.aiDraftAttempt.update({
            where: { id: selectedDraftAttempt.id },
            data: {
              outcome: AiDraftOutcome.SELECTED,
              selectedAt: queuedAt,
              finalizedAt: null,
            },
          });
        }
        return deliveryUpdate;
      });

      if (updated.count !== 1) {
        throw new ConflictException('Cevabın gönderim durumu değişti.');
      }

      answerId = existing.id;
    } else {
      try {
        const delivery = await this.prisma.$transaction(async (transaction) => {
          await this.ensureStoreAcceptsAnswers(transaction, input.storeId);

          const created = await transaction.questionAnswer.create({
            data: {
              storeId: input.storeId,
              connectionId: question.connectionId,
              questionId: question.id,
              requestedByUserId: input.requestedByUserId ?? null,
              draftAttemptId: selectedDraftAttempt?.id ?? null,
              origin,
              composition,
              answer: input.answer,
              queuedAt,
            },
            select: { id: true },
          });
          await transaction.productQuestion.update({
            where: { id: question.id },
            data: { status: ProductQuestionStatus.DRAFTED },
          });
          if (selectedDraftAttempt) {
            await transaction.aiDraftAttempt.update({
              where: { id: selectedDraftAttempt.id },
              data: {
                outcome: AiDraftOutcome.SELECTED,
                selectedAt: queuedAt,
              },
            });
          }
          return created;
        });
        answerId = delivery.id;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException('Bu cevap zaten gönderim kuyruğunda.');
        }
        throw error;
      }
    }

    try {
      await this.dispatch(input.storeId, answerId, queuedAt);
    } catch {
      // A timeout can mean Redis accepted the job. Keep the durable intention;
      // reconciliation will use the same job ID once Redis is reachable again.
      this.logger.warn(
        `Answer ${answerId} saved; queue dispatch awaits reconciliation.`,
      );
    }

    return { id: answerId, status: 'QUEUED', queuedAt };
  }

  private async ensureStoreAcceptsAnswers(
    transaction: Prisma.TransactionClient,
    storeId: string,
  ) {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "store"
      WHERE "id" = ${storeId}
      FOR UPDATE
    `;

    const store = await transaction.store.findUnique({
      where: { id: storeId },
      select: { status: true },
    });

    if (store?.status !== StoreStatus.ACTIVE) {
      throw new ConflictException(
        'Arşivlenmiş veya silinmiş bir mağaza için cevap gönderilemez.',
      );
    }
  }
}

function resolveAnswerComposition(
  answer: string,
  draftAnswer: string | null,
  origin: QuestionAnswerOrigin,
) {
  if (!draftAnswer) return QuestionAnswerComposition.MANUAL;
  if (origin === QuestionAnswerOrigin.AUTOMATION) {
    return QuestionAnswerComposition.AI_UNCHANGED;
  }

  return normalizeAnswer(answer) === normalizeAnswer(draftAnswer)
    ? QuestionAnswerComposition.AI_UNCHANGED
    : QuestionAnswerComposition.AI_EDITED;
}

function normalizeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, ' ');
}

function isEmptyList(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isNonEmptyList(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
