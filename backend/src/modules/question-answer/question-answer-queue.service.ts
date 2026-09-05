import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  AiAutomationMode,
  AiDraftOutcome,
  ChannelConnectionStatus,
  ProductQuestionStatus,
  ProductVariantStatus,
  QuestionAnswerComposition,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import {
  QUESTION_ANSWER_QUEUE,
  SEND_QUESTION_ANSWER_JOB,
} from './question-answer.constants';
import type {
  QueuedQuestionAnswer,
  QuestionAnswerDispatcher,
  QuestionAnswerJobData,
  QueueQuestionAnswerInput,
} from './question-answer.types';
import { hasFreshInventoryForAutomaticAnswer } from './automatic-answer-inventory.guard';

@Injectable()
export class QuestionAnswerQueueService implements QuestionAnswerDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    @InjectQueue(QUESTION_ANSWER_QUEUE)
    private readonly queue: Queue<QuestionAnswerJobData>,
  ) {}

  async enqueue(
    input: QueueQuestionAnswerInput,
  ): Promise<QueuedQuestionAnswer> {
    const origin =
      input.origin === 'AUTOMATION'
        ? QuestionAnswerOrigin.AUTOMATION
        : QuestionAnswerOrigin.MANUAL;
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
          select: { id: true, answer: true, autoSendEligible: true },
        },
        product: {
          select: {
            variants: {
              where: { status: { not: ProductVariantStatus.ARCHIVED } },
              select: { lastSyncedAt: true },
            },
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
        !isNonEmptyList(question.draftEvidenceIds) ||
        !hasFreshInventoryForAutomaticAnswer(
          question.draftEvidenceIds,
          question.product?.variants ?? [],
        ) ||
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

    const queuedAt = new Date();
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
      select: { id: true, status: true },
    });
    let answerId: string;

    if (existing) {
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
        const deliveryUpdate = await transaction.questionAnswer.updateMany({
          where: { id: existing.id, status: QuestionAnswerStatus.FAILED },
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
      await this.queue.add(
        SEND_QUESTION_ANSWER_JOB,
        { storeId: input.storeId, answerId },
        {
          jobId: `question-answer-${answerId}-${queuedAt.getTime()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { count: 250 },
          removeOnFail: { count: 500 },
        },
      );
    } catch (error) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.questionAnswer.updateMany({
          where: { id: answerId, status: QuestionAnswerStatus.QUEUED },
          data: {
            status: QuestionAnswerStatus.FAILED,
            lastError: 'Cevap gönderim kuyruğuna eklenemedi.',
          },
        });
        if (selectedDraftAttempt) {
          await transaction.aiDraftAttempt.updateMany({
            where: { id: selectedDraftAttempt.id },
            data: {
              outcome: AiDraftOutcome.FAILED,
              finalizedAt: new Date(),
            },
          });
        }
      });
      throw new ServiceUnavailableException(
        'Cevap gönderim kuyruğuna şu anda ulaşılamıyor.',
        { cause: error },
      );
    }

    return { id: answerId, status: 'QUEUED', queuedAt };
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
