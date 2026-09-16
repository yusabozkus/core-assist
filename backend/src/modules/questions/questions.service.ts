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
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
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
  ALL_PENDING_QUESTION_STATES,
  PendingQuestionStateFilter,
  QuestionListQueryDto,
  QuestionListStatusFilter,
} from './dto/question-list-query.dto';
import type { ResolveProductKnowledgeDto } from './dto/resolve-product-knowledge.dto';
import { ProductKnowledgeService } from './product-knowledge.service';

const QUESTION_LIST_SELECT = {
  id: true,
  externalProductId: true,
  productTitleSnapshot: true,
  productImageUrlSnapshot: true,
  customerName: true,
  question: true,
  status: true,
  draftDecision: true,
  draftAnswerability: true,
  draftProcessingStatus: true,
  externalCreatedAt: true,
  connection: {
    select: { providerKey: true },
  },
  product: {
    select: {
      id: true,
      title: true,
      images: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { url: true },
      },
    },
  },
  answerDelivery: {
    select: { status: true },
  },
  draftAttempts: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: {
      automationMode: true,
      autoSendEligible: true,
      appliedConfidenceThreshold: true,
    },
  },
} satisfies Prisma.ProductQuestionSelect;

const QUESTION_DETAIL_SELECT = {
  id: true,
  externalQuestionId: true,
  externalProductId: true,
  externalProductRecordId: true,
  productTitleSnapshot: true,
  productImageUrlSnapshot: true,
  customerName: true,
  question: true,
  status: true,
  externalCreatedAt: true,
  createdAt: true,
  answer: true,
  draftDecision: true,
  draftConfidence: true,
  draftAnswerability: true,
  draftRisks: true,
  draftMissingInformation: true,
  draftEvidenceIds: true,
  draftModel: true,
  draftedAt: true,
  draftProcessingStatus: true,
  draftProcessingError: true,
  draftQueuedAt: true,
  draftProcessingStartedAt: true,
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
          externalVariants: {
            select: {
              externalProductId: true,
              price: true,
              currency: true,
              stock: true,
              status: true,
              sourceUpdatedAt: true,
              lastSyncedAt: true,
              externalProduct: {
                select: {
                  connection: { select: { providerKey: true } },
                },
              },
            },
          },
        },
      },
      attributes: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, value: true },
      },
      knowledgeFacts: {
        where: { status: 'VERIFIED' as const },
        orderBy: { verifiedAt: 'desc' as const },
        select: {
          id: true,
          factType: true,
          normalizedKey: true,
          label: true,
          value: true,
          verifiedAt: true,
          variant: {
            select: { id: true, sku: true, size: true, color: true },
          },
        },
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
          externalProductId: true,
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
  draftAttempts: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 12,
    select: {
      id: true,
      trigger: true,
      outcome: true,
      answer: true,
      decision: true,
      confidence: true,
      answerability: true,
      risks: true,
      missingInformation: true,
      evidenceIds: true,
      model: true,
      interpretation: true,
      requestedFacts: true,
      detectedFacts: true,
      automationMode: true,
      autoSendEligible: true,
      appliedConfidenceThreshold: true,
      eligibilityReasons: true,
      selectedAt: true,
      finalizedAt: true,
      createdAt: true,
      requestedBy: { select: { name: true } },
    },
  },
  answerDelivery: {
    select: {
      id: true,
      draftAttemptId: true,
      answer: true,
      origin: true,
      composition: true,
      status: true,
      attempts: true,
      lastError: true,
      queuedAt: true,
      sentAt: true,
    },
  },
} satisfies Prisma.ProductQuestionSelect;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUESTION_SYNC_DISPATCHER)
    private readonly questionSync: QuestionSyncDispatcher,
    @Inject(QUESTION_ANSWER_DISPATCHER)
    private readonly questionAnswers: QuestionAnswerDispatcher,
    private readonly questionDrafts: QuestionDraftService,
    private readonly productKnowledge: ProductKnowledgeService,
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
              productTitleSnapshot: {
                contains: search,
                mode: 'insensitive',
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
      ...questionStatusWhere(query.status, query.pendingStates),
    };

    const [questions, summaryRows] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        orderBy: [{ externalCreatedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: QUESTION_LIST_SELECT,
      }),
      query.includeSummary
        ? this.prisma.productQuestion.groupBy({
            by: ['status'],
            where: baseWhere,
            _count: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const hasNextPage = questions.length > query.limit;
    const pageItems = hasNextPage ? questions.slice(0, query.limit) : questions;

    const page = {
      items: pageItems.map((question) => ({
        ...question,
        product: question.product
          ? {
              id: question.product.id,
              title: question.product.title,
              imageUrl: question.product.images[0]?.url ?? null,
            }
          : null,
        productSnapshot: question.productTitleSnapshot
          ? {
              title: question.productTitleSnapshot,
              imageUrl: question.productImageUrlSnapshot,
            }
          : null,
      })),
      nextCursor: hasNextPage ? (pageItems.at(-1)?.id ?? null) : null,
    };

    if (!summaryRows) return page;

    const counts = new Map(
      summaryRows.map((row) => [row.status, row._count.id]),
    );
    const pending =
      (counts.get(ProductQuestionStatus.PENDING) ?? 0) +
      (counts.get(ProductQuestionStatus.DRAFTED) ?? 0);
    const answered = counts.get(ProductQuestionStatus.ANSWERED) ?? 0;
    const ignored = counts.get(ProductQuestionStatus.IGNORED) ?? 0;
    const total = pending + answered + ignored;

    return {
      ...page,
      total: filteredQuestionTotal(query.status, {
        pending,
        answered,
        ignored,
        total,
      }),
      summary: { total, pending, answered, ignored },
    };
  }

  async findOne(storeId: string, questionId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: QUESTION_DETAIL_SELECT,
    });

    if (!question) {
      throw new NotFoundException('Soru bulunamadı veya erişiminiz yok.');
    }

    const knowledgeGaps = await this.productKnowledge.getQuestionKnowledgeGaps(
      storeId,
      questionId,
    );

    return {
      ...question,
      knowledgeGaps,
      productSnapshot: question.productTitleSnapshot
        ? {
            title: question.productTitleSnapshot,
            imageUrl: question.productImageUrlSnapshot,
          }
        : null,
      product: question.product
        ? {
            ...question.product,
            variants: question.product.variants
              .filter(
                (variant) =>
                  !question.externalProductRecordId ||
                  variant.externalVariants.some(
                    (externalVariant) =>
                      externalVariant.externalProductId ===
                      question.externalProductRecordId,
                  ),
              )
              .map(({ externalVariants, ...variant }) => {
                const channelVariant = question.externalProductRecordId
                  ? externalVariants.find(
                      (externalVariant) =>
                        externalVariant.externalProductId ===
                        question.externalProductRecordId,
                    )
                  : null;
                const stock = channelVariant?.stock ?? variant.stock;

                return {
                  ...variant,
                  price: Number(channelVariant?.price ?? variant.price),
                  currency: channelVariant?.currency ?? variant.currency,
                  stock,
                  status: channelVariant
                    ? channelVariant.status !== 'ACTIVE'
                      ? 'UNAVAILABLE'
                      : stock > 0
                        ? 'ACTIVE'
                        : 'OUT_OF_STOCK'
                    : variant.status,
                  sourceUpdatedAt:
                    channelVariant?.sourceUpdatedAt ?? variant.sourceUpdatedAt,
                  lastSyncedAt:
                    channelVariant?.lastSyncedAt ?? variant.lastSyncedAt,
                  providers: [
                    ...new Set(
                      externalVariants.map(
                        (externalVariant) =>
                          externalVariant.externalProduct.connection
                            .providerKey,
                      ),
                    ),
                  ],
                };
              }),
            sizeGuides: question.product.sizeGuides
              .filter(
                (guide) =>
                  !question.externalProductRecordId ||
                  !guide.externalProductId ||
                  guide.externalProductId === question.externalProductRecordId,
              )
              .map((guide) => ({
                id: guide.id,
                sourceUrl: guide.sourceUrl,
                status: guide.status,
                normalizedText: guide.normalizedText,
                structuredData: guide.structuredData,
                confidence: guide.confidence,
                failureReason: guide.failureReason,
                analyzedAt: guide.analyzedAt,
              })),
          }
        : null,
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

    return this.questionDrafts.generate(storeId, questionId, {
      trigger: 'MANUAL',
      requestedByUserId: userId,
    });
  }

  async resolveKnowledge(
    storeId: string,
    questionId: string,
    userId: string,
    input: ResolveProductKnowledgeDto,
  ) {
    return this.productKnowledge.resolve(storeId, questionId, userId, input);
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
  pendingStates: PendingQuestionStateFilter[],
): Prisma.ProductQuestionWhereInput {
  switch (status) {
    case QuestionListStatusFilter.PENDING:
      return {
        status: {
          in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
        },
        ...(pendingStates.length === ALL_PENDING_QUESTION_STATES.length
          ? {}
          : { OR: pendingStates.map(pendingQuestionStateWhere) }),
      };
    case QuestionListStatusFilter.ANSWERED:
      return { status: ProductQuestionStatus.ANSWERED };
    case QuestionListStatusFilter.IGNORED:
      return { status: ProductQuestionStatus.IGNORED };
    default:
      return {};
  }
}

function pendingQuestionStateWhere(
  state: PendingQuestionStateFilter,
): Prisma.ProductQuestionWhereInput {
  const noAnswerDelivery = { answerDelivery: { is: null } } as const;

  switch (state) {
    case PendingQuestionStateFilter.WAITING:
      return {
        status: ProductQuestionStatus.PENDING,
        draftProcessingStatus: null,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.DRAFT_QUEUED:
      return {
        draftProcessingStatus: QuestionDraftProcessingStatus.QUEUED,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.DRAFT_PROCESSING:
      return {
        draftProcessingStatus: QuestionDraftProcessingStatus.PROCESSING,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.REVIEW_REQUIRED:
      return {
        status: ProductQuestionStatus.DRAFTED,
        draftDecision: QuestionReplyDecision.NEEDS_REVIEW,
        draftProcessingStatus: null,
        OR: [
          noAnswerDelivery,
          {
            answerDelivery: {
              is: { status: QuestionAnswerStatus.FAILED },
            },
          },
        ],
      };
    case PendingQuestionStateFilter.READY_TO_SEND:
      return {
        status: ProductQuestionStatus.DRAFTED,
        draftProcessingStatus: null,
        AND: [
          {
            OR: [
              { draftDecision: QuestionReplyDecision.READY_FOR_SEND },
              { draftDecision: null },
            ],
          },
          noAnswerDelivery,
        ],
      };
    case PendingQuestionStateFilter.SEND_QUEUED:
      return {
        answerDelivery: {
          is: { status: QuestionAnswerStatus.QUEUED },
        },
      };
    case PendingQuestionStateFilter.SENDING:
      return {
        answerDelivery: {
          is: { status: QuestionAnswerStatus.PROCESSING },
        },
      };
    case PendingQuestionStateFilter.BLOCKED_QUOTA:
      return {
        draftProcessingStatus: QuestionDraftProcessingStatus.BLOCKED_QUOTA,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.BLOCKED_SUBSCRIPTION:
      return {
        draftProcessingStatus:
          QuestionDraftProcessingStatus.BLOCKED_SUBSCRIPTION,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.DRAFT_FAILED:
      return {
        draftProcessingStatus: QuestionDraftProcessingStatus.FAILED,
        ...noAnswerDelivery,
      };
    case PendingQuestionStateFilter.SEND_FAILED:
      return {
        answerDelivery: {
          is: { status: QuestionAnswerStatus.FAILED },
        },
        NOT: {
          status: ProductQuestionStatus.DRAFTED,
          draftDecision: QuestionReplyDecision.NEEDS_REVIEW,
        },
      };
  }
}

function filteredQuestionTotal(
  status: QuestionListStatusFilter,
  counts: {
    pending: number;
    answered: number;
    ignored: number;
    total: number;
  },
) {
  switch (status) {
    case QuestionListStatusFilter.PENDING:
      return counts.pending;
    case QuestionListStatusFilter.ANSWERED:
      return counts.answered;
    case QuestionListStatusFilter.IGNORED:
      return counts.ignored;
    default:
      return counts.total;
  }
}
