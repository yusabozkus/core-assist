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
  ProductQuestionStatus,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QUESTION_SYNC_DISPATCHER } from '../question-sync/question-sync.constants';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import { QUESTION_ANSWER_DISPATCHER } from '../question-answer/question-answer.constants';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import { QuestionDraftService } from './question-draft.service';
import {
  QuestionListQueryDto,
  QuestionListStatusFilter,
} from './dto/question-list-query.dto';

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

  async findAll(storeId: string, userId: string, query: QuestionListQueryDto) {
    await this.requireStoreMembership(storeId, userId);

    const search = query.query?.trim();
    const searchWhere: Prisma.ProductQuestionWhereInput = search
      ? {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { question: { contains: search, mode: 'insensitive' } },
            { externalProductId: { contains: search, mode: 'insensitive' } },
            {
              product: {
                is: { title: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              connection: {
                providerKey: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};
    const baseWhere: Prisma.ProductQuestionWhereInput = {
      storeId,
      ...searchWhere,
    };
    const where: Prisma.ProductQuestionWhereInput = {
      ...baseWhere,
      ...questionStatusWhere(query.status),
    };

    const [
      questions,
      filteredTotal,
      summaryTotal,
      pendingCount,
      draftedCount,
      answeredCount,
      ignoredCount,
    ] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        orderBy: [{ externalCreatedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          externalQuestionId: true,
          externalProductId: true,
          customerName: true,
          question: true,
          referenceAnswer: true,
          referenceSourceUrl: true,
          referenceSourceProvider: true,
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
              sizeGuides: {
                orderBy: { updatedAt: 'desc' },
                select: {
                  id: true,
                  sourceUrl: true,
                  status: true,
                  normalizedText: true,
                  structuredData: true,
                  confidence: true,
                  failureReason: true,
                  analyzedAt: true,
                },
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
      }),
      this.prisma.productQuestion.count({ where }),
      this.prisma.productQuestion.count({ where: baseWhere }),
      this.prisma.productQuestion.count({
        where: { ...baseWhere, status: ProductQuestionStatus.PENDING },
      }),
      this.prisma.productQuestion.count({
        where: { ...baseWhere, status: ProductQuestionStatus.DRAFTED },
      }),
      this.prisma.productQuestion.count({
        where: { ...baseWhere, status: ProductQuestionStatus.ANSWERED },
      }),
      this.prisma.productQuestion.count({
        where: { ...baseWhere, status: ProductQuestionStatus.IGNORED },
      }),
    ]);

    const hasNextPage = questions.length > query.limit;
    const pageItems = hasNextPage ? questions.slice(0, query.limit) : questions;

    return {
      items: pageItems.map((question) => ({
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
      })),
      nextCursor: hasNextPage ? (pageItems.at(-1)?.id ?? null) : null,
      total: filteredTotal,
      summary: {
        total: summaryTotal,
        pending: pendingCount + draftedCount,
        answered: answeredCount,
        ignored: ignoredCount,
      },
    };
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
      syncRunIds: results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value.syncRunId] : [],
      ),
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
    const membership = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        userId,
        store: { status: StoreStatus.ACTIVE },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }

    return membership;
  }
}

function questionStatusWhere(
  status: QuestionListStatusFilter,
): Prisma.ProductQuestionWhereInput {
  switch (status) {
    case QuestionListStatusFilter.PENDING:
      return {
        status: {
          in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
        },
      };
    case QuestionListStatusFilter.ANSWERED:
      return { status: ProductQuestionStatus.ANSWERED };
    case QuestionListStatusFilter.IGNORED:
      return { status: ProductQuestionStatus.IGNORED };
    default:
      return {};
  }
}
