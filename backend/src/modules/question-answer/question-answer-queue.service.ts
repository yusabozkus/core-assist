import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  ChannelConnectionStatus,
  ProductQuestionStatus,
  QuestionAnswerStatus,
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
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: input.questionId, storeId: input.storeId },
      select: {
        id: true,
        status: true,
        connectionId: true,
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

      const updated = await this.prisma.questionAnswer.updateMany({
        where: { id: existing.id, status: QuestionAnswerStatus.FAILED },
        data: {
          answer: input.answer,
          requestedByUserId: input.requestedByUserId,
          status: QuestionAnswerStatus.QUEUED,
          lastError: null,
          queuedAt,
          processingStartedAt: null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Cevabın gönderim durumu değişti.');
      }

      answerId = existing.id;
    } else {
      try {
        const [delivery] = await this.prisma.$transaction([
          this.prisma.questionAnswer.create({
            data: {
              storeId: input.storeId,
              connectionId: question.connectionId,
              questionId: question.id,
              requestedByUserId: input.requestedByUserId,
              answer: input.answer,
              queuedAt,
            },
            select: { id: true },
          }),
          this.prisma.productQuestion.update({
            where: { id: question.id },
            data: { status: ProductQuestionStatus.DRAFTED },
          }),
        ]);
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
      await this.prisma.questionAnswer.updateMany({
        where: { id: answerId, status: QuestionAnswerStatus.QUEUED },
        data: {
          status: QuestionAnswerStatus.FAILED,
          lastError: 'Cevap gönderim kuyruğuna eklenemedi.',
        },
      });
      throw new ServiceUnavailableException(
        'Cevap gönderim kuyruğuna şu anda ulaşılamıyor.',
        { cause: error },
      );
    }

    return { id: answerId, status: 'QUEUED', queuedAt };
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
