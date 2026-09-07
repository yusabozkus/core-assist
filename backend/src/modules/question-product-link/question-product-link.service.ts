import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductQuestionStatus } from '../../generated/prisma/enums';

type ExternalProductMatch = {
  id: string;
  productId: string;
  product: {
    title: string;
    images: Array<{ url: string }>;
  };
};

@Injectable()
export class QuestionProductLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveExternalProduct(
    connectionId: string,
    externalProductId: string,
  ): Promise<ExternalProductMatch | null> {
    const exactProduct = await this.prisma.externalProduct.findUnique({
      where: {
        connectionId_externalId: {
          connectionId,
          externalId: externalProductId,
        },
      },
      select: externalProductMatchSelect,
    });

    if (exactProduct) return exactProduct;

    const matchedVariant = await this.prisma.externalProductVariant.findFirst({
      where: {
        externalProduct: { connectionId },
        OR: [
          { externalId: externalProductId },
          { sku: externalProductId },
          { barcode: externalProductId },
        ],
      },
      select: { externalProduct: { select: externalProductMatchSelect } },
    });

    return matchedVariant?.externalProduct ?? null;
  }

  async linkQuestionIfPossible(storeId: string, questionId: string) {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        id: true,
        connectionId: true,
        externalProductId: true,
        productId: true,
      },
    });

    if (!question || question.productId) return false;

    const externalProduct = await this.resolveExternalProduct(
      question.connectionId,
      question.externalProductId,
    );

    if (!externalProduct) return false;

    const linked = await this.prisma.productQuestion.updateMany({
      where: { id: question.id, storeId, productId: null },
      data: questionProductLinkData(externalProduct),
    });

    return linked.count === 1;
  }

  async reconcilePendingQuestions(
    storeId: string,
    connectionId: string,
  ): Promise<string[]> {
    const questions = await this.prisma.productQuestion.findMany({
      where: {
        storeId,
        connectionId,
        productId: null,
        status: ProductQuestionStatus.PENDING,
      },
      select: {
        id: true,
        externalProductId: true,
      },
    });
    const recoveredQuestionIds: string[] = [];

    for (const question of questions) {
      const externalProduct = await this.resolveExternalProduct(
        connectionId,
        question.externalProductId,
      );
      if (!externalProduct) continue;

      const linked = await this.prisma.productQuestion.updateMany({
        where: {
          id: question.id,
          storeId,
          connectionId,
          productId: null,
          status: ProductQuestionStatus.PENDING,
        },
        data: questionProductLinkData(externalProduct),
      });

      if (linked.count === 1) {
        recoveredQuestionIds.push(question.id);
      }
    }

    return recoveredQuestionIds;
  }
}

const externalProductMatchSelect = {
  id: true,
  productId: true,
  product: {
    select: {
      title: true,
      images: {
        orderBy: { position: 'asc' as const },
        take: 1,
        select: { url: true },
      },
    },
  },
} as const;

function questionProductLinkData(externalProduct: ExternalProductMatch) {
  return {
    productId: externalProduct.productId,
    externalProductRecordId: externalProduct.id,
    productTitleSnapshot: externalProduct.product.title,
    productImageUrlSnapshot: externalProduct.product.images[0]?.url ?? null,
  };
}
