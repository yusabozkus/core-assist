import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelType,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { QUESTION_SYNC_DISPATCHER } from '../question-sync/question-sync.constants';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import { QUESTION_ANSWER_DISPATCHER } from '../question-answer/question-answer.constants';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import { QuestionDraftService } from './question-draft.service';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUESTION_SYNC_DISPATCHER)
    private readonly questionSync: QuestionSyncDispatcher,
    @Inject(QUESTION_ANSWER_DISPATCHER)
    private readonly questionAnswers: QuestionAnswerDispatcher,
    private readonly questionDrafts: QuestionDraftService,
  ) {}

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    const questions = await this.prisma.productQuestion.findMany({
      where: { storeId },
      orderBy: { externalCreatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        externalQuestionId: true,
        externalProductId: true,
        customerName: true,
        question: true,
        status: true,
        externalCreatedAt: true,
        createdAt: true,
        answer: true,
        answeredAt: true,
        connection: {
          select: { providerKey: true },
        },
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            brand: true,
            category: true,
            status: true,
            updatedAt: true,
            variants: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                title: true,
                sku: true,
                barcode: true,
                color: true,
                size: true,
                price: true,
                currency: true,
                stock: true,
                status: true,
                sourceUpdatedAt: true,
                lastSyncedAt: true,
              },
            },
            attributes: {
              orderBy: { name: 'asc' },
              select: { id: true, name: true, value: true },
            },
            images: {
              orderBy: { position: 'asc' },
              select: { id: true, url: true, position: true },
            },
            externalProducts: {
              select: {
                externalId: true,
                externalUrl: true,
                status: true,
                lastSyncedAt: true,
                connection: {
                  select: { providerKey: true },
                },
              },
            },
          },
        },
        answerDelivery: {
          select: {
            id: true,
            answer: true,
            status: true,
            attempts: true,
            lastError: true,
            queuedAt: true,
            sentAt: true,
          },
        },
      },
    });

    return questions.map((question) => ({
      ...question,
      product: question.product
        ? {
            ...question.product,
            variants: question.product.variants.map((variant) => ({
              ...variant,
              price: Number(variant.price),
            })),
          }
        : null,
    }));
  }

  async sync(storeId: string, userId: string) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (
      membership.role !== StoreRole.OWNER &&
      membership.role !== StoreRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Ürün sorularını senkronize etme yetkiniz bulunmuyor.',
      );
    }

    const connections = await this.prisma.channelConnection.findMany({
      where: {
        storeId,
        type: ChannelType.COMMERCE,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
      },
      select: { id: true },
    });
    const results = await Promise.allSettled(
      connections.map((connection) =>
        this.questionSync.enqueue(storeId, connection.id),
      ),
    );
    const unexpectedFailure = results.find(
      (result) =>
        result.status === 'rejected' &&
        !(result.reason instanceof ConflictException),
    );

    if (unexpectedFailure?.status === 'rejected') {
      throw unexpectedFailure.reason;
    }

    return {
      status: 'RUNNING' as const,
      queued: results.filter((result) => result.status === 'fulfilled').length,
      skipped: results.filter((result) => result.status === 'rejected').length,
    };
  }

  async answer(
    storeId: string,
    questionId: string,
    userId: string,
    answer: string,
  ) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (membership.role === StoreRole.VIEWER) {
      throw new ForbiddenException(
        'Ürün sorularını yanıtlama yetkiniz bulunmuyor.',
      );
    }

    return this.questionAnswers.enqueue({
      storeId,
      questionId,
      requestedByUserId: userId,
      answer,
    });
  }

  async draft(storeId: string, questionId: string, userId: string) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (membership.role === StoreRole.VIEWER) {
      throw new ForbiddenException(
        'Ürün soruları için taslak oluşturma yetkiniz bulunmuyor.',
      );
    }

    return this.questionDrafts.generate(storeId, questionId);
  }

  private async requireStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return membership;
  }
}
