import { ConflictException, Injectable } from '@nestjs/common';
import { ProductQuestionStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { AiDraftGenerator } from '../ai/ai-draft.types';
import {
  isSellableVariant,
  ProductAnswerContextService,
} from './product-answer-context.service';
import type {
  DraftQuestionAnswer,
  ProductAnswerContext,
} from './product-answer-context.types';

@Injectable()
export class QuestionDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productContext: ProductAnswerContextService,
    private readonly aiDrafts: AiDraftGenerator,
  ) {}

  async generate(
    storeId: string,
    questionId: string,
  ): Promise<DraftQuestionAnswer> {
    const context = await this.productContext.build(storeId, questionId);
    const aiDraft = await this.aiDrafts.generate(context);
    const answer = aiDraft?.answer ?? createCatalogDraft(context);
    const updated = await this.prisma.productQuestion.updateMany({
      where: {
        id: questionId,
        storeId,
        status: {
          in: [ProductQuestionStatus.PENDING, ProductQuestionStatus.DRAFTED],
        },
      },
      data: {
        answer,
        status: ProductQuestionStatus.DRAFTED,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Taslak oluşturulurken soru durumu değişti.');
    }

    return {
      answer,
      status: 'DRAFTED',
      context: {
        requestedFacts: context.requestedFacts,
        matchedColor: context.matchedColor,
        matchedSize: context.matchedSize,
        matchingVariantCount: context.matchingVariants.length,
        source: aiDraft?.source ?? 'CATALOG',
        model: aiDraft?.model ?? null,
        decision: aiDraft?.decision ?? 'DRAFT',
        confidence: aiDraft?.confidence ?? null,
        missingInformation: aiDraft?.missingInformation ?? [],
      },
    };
  }
}

export function createCatalogDraft(context: ProductAnswerContext) {
  const { product, requestedFacts } = context;
  const includesStock = requestedFacts.includes('STOCK');
  const includesPrice = requestedFacts.includes('PRICE');
  const parts: string[] = ['Merhaba,'];

  if (includesStock) {
    parts.push(createStockSentence(context));
  }

  if (includesPrice) {
    const variantsForPrice =
      context.matchingVariants.length > 0
        ? context.matchingVariants
        : product.variants;
    parts.push(
      `${variantSubject(context, product.title, 'genitive')} güncel fiyatı ${formatPriceRange(variantsForPrice)}.`,
    );
  }

  if (requestedFacts.includes('MATERIAL')) {
    const materialAttributes = product.attributes.filter((attribute) =>
      /(materyal|malzeme|kumaş|dış materyal)/i.test(attribute.name),
    );
    parts.push(
      materialAttributes.length > 0
        ? `${product.title} ürününün ${formatAttributes(materialAttributes)}.`
        : product.description
          ? product.description
          : 'Ürünün materyal bilgisi katalogda yer almıyor; kontrol ederek dönüş sağlayacağız.',
    );
  }

  if (requestedFacts.includes('DURABILITY')) {
    const durabilityAttributes = product.attributes.filter((attribute) =>
      /(kararma|solma|paslan|kaplama|toka|dayanıklılık|garanti)/i.test(
        `${attribute.name} ${attribute.value}`,
      ),
    );
    parts.push(
      durabilityAttributes.length > 0
        ? `${product.title} ürününün ${formatAttributes(durabilityAttributes)}.`
        : 'Ürünün kararma ve kullanım sonrası dayanıklılık bilgisi katalogda belirtilmediği için bu konuda kesin bilgi veremiyoruz.',
    );
  }

  if (requestedFacts.includes('SHIPPING')) {
    parts.push(
      'Kargo ve teslimat süresi adres ve sipariş koşullarına göre değişebildiği için güncel bilgiyi kontrol ederek paylaşacağız.',
    );
  }

  if (requestedFacts.includes('PRODUCT_INFO')) {
    if (context.relevantAttributes.length > 0) {
      parts.push(
        `${product.title} ürününün ${formatAttributes(context.relevantAttributes)}.`,
      );
    } else if (product.description) {
      parts.push(product.description);
    } else if (product.attributes.length > 0) {
      parts.push(
        `${product.title} ürününün ${formatAttributes(product.attributes.slice(0, 3))}.`,
      );
    } else {
      parts.push(
        'Bu ürünle ilgili katalogda yeterli bilgi bulunmuyor; kontrol ederek dönüş sağlayacağız.',
      );
    }
  }

  return parts.join(' ');
}

function createStockSentence(context: ProductAnswerContext) {
  const subject = variantSubject(context, context.product.title, 'nominative');

  if (context.matchingVariants.length === 0) {
    return `Maalesef ${subject} katalogda bulunmuyor.`;
  }

  const sellableVariants = context.matchingVariants.filter(isSellableVariant);
  const totalStock = sellableVariants.reduce(
    (total, variant) => total + variant.stock,
    0,
  );

  if (totalStock <= 0) {
    return `Maalesef ${subject} şu anda stokta bulunmuyor.`;
  }

  return `Evet, ${subject} şu anda stokta mevcut (${totalStock} adet).`;
}

function variantSubject(
  context: ProductAnswerContext,
  productTitle: string,
  form: 'genitive' | 'nominative',
) {
  const selections = [context.requestedColor, context.requestedSize].filter(
    Boolean,
  );

  if (form === 'genitive') {
    return selections.length > 0
      ? `${productTitle} ürününün ${selections.join(' / ')} seçeneğinin`
      : `${productTitle} ürününün`;
  }

  return selections.length > 0
    ? `${productTitle} ürününün ${selections.join(' / ')} seçeneği`
    : `${productTitle} ürünü`;
}

function formatAttributes(attributes: Array<{ name: string; value: string }>) {
  return attributes
    .map(
      (attribute) =>
        `${attribute.name.toLocaleLowerCase('tr-TR')} bilgisi ${attribute.value}`,
    )
    .join(', ');
}

function formatPriceRange(
  variants: ProductAnswerContext['product']['variants'],
) {
  if (variants.length === 0) return 'katalogda bulunmuyor';

  const prices = variants.map((variant) => variant.price);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const currency = variants[0].currency;

  if (minimum === maximum) return formatPrice(minimum, currency);
  return `${formatPrice(minimum, currency)} ile ${formatPrice(maximum, currency)} arasında`;
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
