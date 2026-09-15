import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiDraftOutcome,
  ProductKnowledgeFactStatus,
  ProductQuestionStatus,
  QuestionReplyDecision,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QUESTION_DRAFT_DISPATCHER } from './question-draft.constants';
import type { QuestionDraftDispatcher } from './question-draft.types';
import type { ResolveProductKnowledgeDto } from './dto/resolve-product-knowledge.dto';
import type { UpdateProductKnowledgeDto } from './dto/update-product-knowledge.dto';
import {
  extractProductKnowledgeGaps,
  isUnusualKnowledgeMeasurement,
  questionMatchesKnowledgeVariant,
  type ProductKnowledgeGap,
} from './product-knowledge-gap';

const KNOWLEDGE_CANDIDATE_SELECT = {
  id: true,
  question: true,
  draftMissingInformation: true,
  draftAttempts: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { requestedFacts: true, detectedFacts: true },
  },
} satisfies Prisma.ProductQuestionSelect;

@Injectable()
export class ProductKnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUESTION_DRAFT_DISPATCHER)
    private readonly draftQueue: QuestionDraftDispatcher,
  ) {}

  async getQuestionKnowledgeGaps(storeId: string, questionId: string) {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        id: true,
        question: true,
        status: true,
        productId: true,
        draftDecision: true,
        draftMissingInformation: true,
        draftAttempts: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { requestedFacts: true, detectedFacts: true },
        },
      },
    });

    if (
      !question?.productId ||
      question.status !== ProductQuestionStatus.DRAFTED ||
      question.draftDecision !== QuestionReplyDecision.NEEDS_REVIEW
    ) {
      return [];
    }

    const gaps = gapsForQuestion(question);
    if (gaps.length === 0) return [];

    const candidates = await this.findCandidates(storeId, question.productId);
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      for (const gap of gapsForQuestion(candidate)) {
        counts.set(gap.key, (counts.get(gap.key) ?? 0) + 1);
      }
    }

    return gaps.map((gap) => ({
      ...gap,
      affectedQuestionCount: Math.max(1, counts.get(gap.key) ?? 0),
    }));
  }

  async resolve(
    storeId: string,
    questionId: string,
    userId: string,
    input: ResolveProductKnowledgeDto,
  ) {
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
    if (membership.role === StoreRole.VIEWER) {
      throw new ForbiddenException(
        'Doğrulanmış ürün bilgisi ekleme yetkiniz bulunmuyor.',
      );
    }

    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        id: true,
        question: true,
        productId: true,
        status: true,
        draftDecision: true,
        draftMissingInformation: true,
        answerDelivery: { select: { id: true } },
        draftAttempts: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { requestedFacts: true, detectedFacts: true },
        },
        product: {
          select: {
            variants: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                title: true,
                sku: true,
                size: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!question?.productId || !question.product) {
      throw new NotFoundException('Soruya bağlı katalog ürünü bulunamadı.');
    }
    if (
      question.status !== ProductQuestionStatus.DRAFTED ||
      question.draftDecision !== QuestionReplyDecision.NEEDS_REVIEW ||
      question.answerDelivery
    ) {
      throw new HttpException(
        'Bu soru artık doğrulanmış ürün bilgisi beklemiyor.',
        HttpStatus.CONFLICT,
      );
    }

    const gap = gapsForQuestion(question).find(
      (candidate) => candidate.key === input.gapKey,
    );
    if (!gap) {
      throw new HttpException(
        'Eksik bilgi alanı değişti. Soruyu yenileyip tekrar deneyin.',
        HttpStatus.CONFLICT,
      );
    }

    if (
      isUnusualKnowledgeMeasurement(gap.key, input.value) &&
      !input.confirmUnusualValue
    ) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'PRODUCT_KNOWLEDGE_CONFIRMATION_REQUIRED',
          message:
            'Girdiğiniz ölçü olağan dışı görünüyor. Değeri kontrol edip onaylayın.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const selectedVariant = input.variantId
      ? question.product.variants.find(
          (variant) => variant.id === input.variantId,
        )
      : null;
    if (input.variantId && !selectedVariant) {
      throw new HttpException(
        'Seçilen varyant bu ürüne ait değil veya artık aktif değil.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const candidates = await this.findCandidates(storeId, question.productId);
    const matchingQuestionIds = candidates
      .filter((candidate) =>
        gapsForQuestion(candidate).some(
          (candidateGap) => candidateGap.key === gap.key,
        ),
      )
      .filter(
        (candidate) =>
          candidate.id === questionId ||
          !selectedVariant ||
          questionMatchesKnowledgeVariant(candidate.question, selectedVariant),
      )
      .map((candidate) => candidate.id);

    if (!matchingQuestionIds.includes(questionId)) {
      matchingQuestionIds.unshift(questionId);
    }

    const now = new Date();
    const scopeKey = selectedVariant
      ? `VARIANT:${selectedVariant.id}`
      : 'PRODUCT';
    const result = await this.prisma.$transaction(async (transaction) => {
      const fact = await transaction.productKnowledgeFact.upsert({
        where: {
          productId_scopeKey_normalizedKey: {
            productId: question.productId!,
            scopeKey,
            normalizedKey: gap.key,
          },
        },
        create: {
          storeId,
          productId: question.productId!,
          variantId: selectedVariant?.id,
          scopeKey,
          factType: gap.factType,
          normalizedKey: gap.key,
          label: gap.label,
          value: input.value,
          verifiedByUserId: userId,
          originatingQuestionId: questionId,
          verifiedAt: now,
        },
        update: {
          variantId: selectedVariant?.id ?? null,
          factType: gap.factType,
          label: gap.label,
          value: input.value,
          status: ProductKnowledgeFactStatus.VERIFIED,
          verifiedByUserId: userId,
          originatingQuestionId: questionId,
          verifiedAt: now,
          archivedAt: null,
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          factType: true,
          normalizedKey: true,
          label: true,
          value: true,
          verifiedAt: true,
        },
      });

      await transaction.aiDraftAttempt.updateMany({
        where: {
          questionId: { in: matchingQuestionIds },
          outcome: AiDraftOutcome.AVAILABLE,
        },
        data: { outcome: AiDraftOutcome.SUPERSEDED, finalizedAt: now },
      });

      const reset = await transaction.productQuestion.updateMany({
        where: {
          id: { in: matchingQuestionIds },
          storeId,
          status: {
            in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
          },
          answerDelivery: { is: null },
        },
        data: {
          answer: null,
          status: ProductQuestionStatus.PENDING,
          draftDecision: null,
          draftConfidence: null,
          draftAnswerability: null,
          draftRisks: Prisma.DbNull,
          draftMissingInformation: Prisma.DbNull,
          draftEvidenceIds: Prisma.DbNull,
          draftModel: null,
          draftedAt: null,
          draftProcessingStatus: null,
          draftProcessingError: null,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });

      return { fact, resetCount: reset.count };
    });

    const queueResults = await Promise.allSettled(
      matchingQuestionIds.map((candidateQuestionId) =>
        this.draftQueue.enqueue(storeId, candidateQuestionId, {
          reason: 'KNOWLEDGE_RESOLVED',
          requestedByUserId: userId,
        }),
      ),
    );

    return {
      fact: result.fact,
      affectedQuestionCount: result.resetCount,
      queuedQuestionCount: queueResults.filter(
        (queueResult) => queueResult.status === 'fulfilled',
      ).length,
    };
  }

  async updateFact(
    storeId: string,
    factId: string,
    userId: string,
    input: UpdateProductKnowledgeDto,
  ) {
    await this.requireFactEditor(storeId, userId);
    const fact = await this.prisma.productKnowledgeFact.findFirst({
      where: {
        id: factId,
        storeId,
        status: ProductKnowledgeFactStatus.VERIFIED,
        product: { status: 'ACTIVE' },
      },
      select: { id: true, productId: true, normalizedKey: true },
    });
    if (!fact) {
      throw new NotFoundException('Doğrulanmış ürün bilgisi bulunamadı.');
    }
    if (
      isUnusualKnowledgeMeasurement(fact.normalizedKey, input.value) &&
      !input.confirmUnusualValue
    ) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'PRODUCT_KNOWLEDGE_CONFIRMATION_REQUIRED',
          message:
            'Girdiğiniz ölçü olağan dışı görünüyor. Değeri kontrol edip onaylayın.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const updated = await this.prisma.productKnowledgeFact.update({
      where: { id: fact.id },
      data: {
        value: input.value,
        verifiedByUserId: userId,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        factType: true,
        normalizedKey: true,
        label: true,
        value: true,
        verifiedAt: true,
      },
    });
    const reprocessed = await this.reprocessDraftsUsingFact(
      storeId,
      fact.productId,
      fact.id,
      userId,
    );

    return { fact: updated, ...reprocessed };
  }

  async archiveFact(storeId: string, factId: string, userId: string) {
    await this.requireFactEditor(storeId, userId);
    const fact = await this.prisma.productKnowledgeFact.findFirst({
      where: {
        id: factId,
        storeId,
        status: ProductKnowledgeFactStatus.VERIFIED,
        product: { status: 'ACTIVE' },
      },
      select: { id: true, productId: true },
    });
    if (!fact) {
      throw new NotFoundException('Doğrulanmış ürün bilgisi bulunamadı.');
    }

    await this.prisma.productKnowledgeFact.update({
      where: { id: fact.id },
      data: {
        status: ProductKnowledgeFactStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
    const reprocessed = await this.reprocessDraftsUsingFact(
      storeId,
      fact.productId,
      fact.id,
      userId,
    );

    return {
      id: fact.id,
      status: ProductKnowledgeFactStatus.ARCHIVED,
      ...reprocessed,
    };
  }

  private findCandidates(storeId: string, productId: string) {
    return this.prisma.productQuestion.findMany({
      where: {
        storeId,
        productId,
        status: {
          in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
        },
        draftDecision: QuestionReplyDecision.NEEDS_REVIEW,
        answerDelivery: { is: null },
      },
      orderBy: [{ externalCreatedAt: 'asc' }, { id: 'asc' }],
      select: KNOWLEDGE_CANDIDATE_SELECT,
    });
  }

  private async requireFactEditor(storeId: string, userId: string) {
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
    if (membership.role === StoreRole.VIEWER) {
      throw new ForbiddenException(
        'Doğrulanmış ürün bilgisini değiştirme yetkiniz bulunmuyor.',
      );
    }
  }

  private async reprocessDraftsUsingFact(
    storeId: string,
    productId: string,
    factId: string,
    userId: string,
  ) {
    const evidenceId = `merchant-verified-${factId}`;
    const questions = await this.prisma.productQuestion.findMany({
      where: {
        storeId,
        productId,
        status: ProductQuestionStatus.DRAFTED,
        answerDelivery: { is: null },
      },
      select: { id: true, draftEvidenceIds: true },
    });
    const questionIds = questions
      .filter(
        (question) =>
          Array.isArray(question.draftEvidenceIds) &&
          question.draftEvidenceIds.includes(evidenceId),
      )
      .map((question) => question.id);
    if (questionIds.length === 0) {
      return { affectedQuestionCount: 0, queuedQuestionCount: 0 };
    }

    const now = new Date();
    const resetCount = await this.prisma.$transaction(async (transaction) => {
      await transaction.aiDraftAttempt.updateMany({
        where: {
          questionId: { in: questionIds },
          outcome: AiDraftOutcome.AVAILABLE,
        },
        data: { outcome: AiDraftOutcome.SUPERSEDED, finalizedAt: now },
      });
      const reset = await transaction.productQuestion.updateMany({
        where: {
          id: { in: questionIds },
          storeId,
          status: ProductQuestionStatus.DRAFTED,
          answerDelivery: { is: null },
        },
        data: {
          answer: null,
          status: ProductQuestionStatus.PENDING,
          draftDecision: null,
          draftConfidence: null,
          draftAnswerability: null,
          draftRisks: Prisma.DbNull,
          draftMissingInformation: Prisma.DbNull,
          draftEvidenceIds: Prisma.DbNull,
          draftModel: null,
          draftedAt: null,
          draftProcessingStatus: null,
          draftProcessingError: null,
          draftQueuedAt: null,
          draftProcessingStartedAt: null,
        },
      });
      return reset.count;
    });

    const queueResults = await Promise.allSettled(
      questionIds.map((questionId) =>
        this.draftQueue.enqueue(storeId, questionId, {
          reason: 'KNOWLEDGE_RESOLVED',
          requestedByUserId: userId,
        }),
      ),
    );

    return {
      affectedQuestionCount: resetCount,
      queuedQuestionCount: queueResults.filter(
        (result) => result.status === 'fulfilled',
      ).length,
    };
  }
}

function gapsForQuestion(input: {
  question: string;
  draftMissingInformation: unknown;
  draftAttempts: Array<{
    requestedFacts: unknown;
    detectedFacts: unknown;
  }>;
}): ProductKnowledgeGap[] {
  return extractProductKnowledgeGaps({
    question: input.question,
    missingInformation: input.draftMissingInformation,
    requestedFacts: input.draftAttempts[0]?.requestedFacts,
    detectedFacts: input.draftAttempts[0]?.detectedFacts,
  });
}
