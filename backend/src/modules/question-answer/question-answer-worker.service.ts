import { Injectable } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ProductQuestionStatus,
  QuestionAnswerStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import type { QuestionAnswerJobData } from './question-answer.types';

@Injectable()
export class QuestionAnswerWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
  ) {}

  async run(data: QuestionAnswerJobData) {
    const delivery = await this.prisma.questionAnswer.findFirst({
      where: { id: data.answerId, storeId: data.storeId },
      select: {
        id: true,
        answer: true,
        status: true,
        questionId: true,
        question: { select: { externalQuestionId: true } },
        connection: {
          select: {
            providerKey: true,
            environment: true,
            status: true,
            credentialsEncrypted: true,
          },
        },
      },
    });

    if (!delivery) throw new Error('Question answer delivery is unavailable.');
    if (delivery.status === QuestionAnswerStatus.SENT) return;
    if (delivery.connection.status !== ChannelConnectionStatus.CONNECTED) {
      throw new Error('Question channel connection is not active.');
    }
    if (!delivery.connection.credentialsEncrypted) {
      throw new Error('Question channel credentials are unavailable.');
    }

    await this.prisma.questionAnswer.update({
      where: { id: delivery.id },
      data: {
        status: QuestionAnswerStatus.PROCESSING,
        attempts: { increment: 1 },
        processingStartedAt: new Date(),
        lastError: null,
      },
    });

    const credentials = this.encryption.decrypt(
      delivery.connection.credentialsEncrypted,
    );
    const result = await this.providers.sendProductQuestionAnswer(
      delivery.connection.providerKey,
      {
        environment: delivery.connection.environment,
        credentials,
      },
      delivery.question.externalQuestionId,
      delivery.answer,
    );

    await this.prisma.$transaction([
      this.prisma.questionAnswer.update({
        where: { id: delivery.id },
        data: {
          status: QuestionAnswerStatus.SENT,
          externalAnswerId: result.externalAnswerId ?? null,
          sentAt: result.answeredAt,
          processingStartedAt: null,
          lastError: null,
        },
      }),
      this.prisma.productQuestion.update({
        where: { id: delivery.questionId },
        data: {
          status: ProductQuestionStatus.ANSWERED,
          answer: delivery.answer,
          answeredAt: result.answeredAt,
        },
      }),
    ]);
  }

  async markFinalFailure(data: QuestionAnswerJobData, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Cevap gönderilemedi.';

    await this.prisma.questionAnswer.updateMany({
      where: {
        id: data.answerId,
        storeId: data.storeId,
        status: { not: QuestionAnswerStatus.SENT },
      },
      data: {
        status: QuestionAnswerStatus.FAILED,
        processingStartedAt: null,
        lastError: message,
      },
    });
  }
}
