import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductQuestionStatus,
  ProductVariantStatus,
  QuestionAnswerStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type {
  ProductAnswerContext,
  ProductAnswerFact,
} from './product-answer-context.types';

const STOCK_PATTERNS = ['stok', 'var mi', 'mevcut', 'kaldi', 'bulunuyor'];
const PRICE_PATTERNS = ['fiyat', 'ne kadar', 'kac tl', 'ucret'];
const MATERIAL_PATTERNS = ['materyal', 'malzeme', 'kumas', 'deri mi', 'pamuk'];
const DURABILITY_PATTERNS = [
  'kararma',
  'kararir',
  'solma',
  'solar',
  'paslan',
  'soyul',
  'dokul',
  'dayanikli',
  'su gecir',
];
const SHIPPING_PATTERNS = ['kargo', 'teslim', 'gonderim', 'ne zaman gelir'];
const COMMON_COLORS = [
  'Siyah',
  'Beyaz',
  'Ekru',
  'Kırmızı',
  'Mavi',
  'Lacivert',
  'Yeşil',
  'Haki',
  'Bej',
  'Gri',
  'Antrasit',
  'Füme',
  'Bordo',
  'Kahverengi',
  'Taba',
  'Vizon',
  'Pudra',
  'Turuncu',
  'Şampanya',
];
const IGNORED_ATTRIBUTE_TOKENS = new Set([
  'bir',
  'bu',
  'icin',
  'mi',
  'mu',
  'mı',
  'mü',
  'nasıl',
  'nasil',
  'var',
]);

@Injectable()
export class ProductAnswerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    storeId: string,
    questionId: string,
  ): Promise<ProductAnswerContext> {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, storeId },
      select: {
        id: true,
        question: true,
        status: true,
        answerDelivery: {
          select: { status: true },
        },
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            attributes: {
              orderBy: { name: 'asc' },
              select: { name: true, value: true },
            },
            variants: {
              orderBy: { createdAt: 'asc' },
              select: {
                title: true,
                sku: true,
                color: true,
                size: true,
                price: true,
                currency: true,
                stock: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Ürün sorusu bulunamadı.');
    }

    if (question.status === ProductQuestionStatus.ANSWERED) {
      throw new ConflictException(
        'Yanıtlanmış soru için taslak oluşturulamaz.',
      );
    }

    if (question.status === ProductQuestionStatus.IGNORED) {
      throw new ConflictException('Yoksayılan soru için taslak oluşturulamaz.');
    }

    if (
      question.answerDelivery?.status === QuestionAnswerStatus.QUEUED ||
      question.answerDelivery?.status === QuestionAnswerStatus.PROCESSING
    ) {
      throw new ConflictException(
        'Gönderim kuyruğundaki cevap için yeni taslak oluşturulamaz.',
      );
    }

    if (question.answerDelivery?.status === QuestionAnswerStatus.SENT) {
      throw new ConflictException(
        'Gönderilmiş cevap için taslak oluşturulamaz.',
      );
    }

    if (!question.product) {
      throw new ConflictException(
        'Taslak oluşturmak için soru bir katalog ürünüyle eşleşmelidir.',
      );
    }

    const normalizedQuestion = normalizeSearchValue(question.question);
    const variants = question.product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
    }));
    const availableColors = uniqueValues(
      variants.map((variant) => variant.color),
    );
    const availableSizes = uniqueValues(
      variants.map((variant) => variant.size),
    );
    const requestedColor = findMention(
      normalizedQuestion,
      uniqueValues([...availableColors, ...COMMON_COLORS]),
    );
    const requestedSize =
      findMention(normalizedQuestion, availableSizes) ??
      findGenericSizeMention(normalizedQuestion);
    const matchedColor = findEquivalentValue(requestedColor, availableColors);
    const matchedSize = findEquivalentValue(requestedSize, availableSizes);
    const matchingVariants = variants.filter((variant) => {
      if (requestedColor && !matchedColor) return false;
      if (requestedSize && !matchedSize) return false;

      return (
        (!matchedColor || sameValue(variant.color, matchedColor)) &&
        (!matchedSize || sameValue(variant.size, matchedSize))
      );
    });
    const requestedFacts = detectRequestedFacts(
      normalizedQuestion,
      requestedColor,
      requestedSize,
    );
    const relevantAttributes = findRelevantAttributes(
      normalizedQuestion,
      question.product.attributes,
    );

    return {
      questionId: question.id,
      question: question.question,
      requestedFacts,
      requestedColor,
      requestedSize,
      matchedColor,
      matchedSize,
      product: {
        id: question.product.id,
        title: question.product.title,
        description: question.product.description,
        attributes: question.product.attributes,
        variants,
      },
      matchingVariants,
      relevantAttributes,
    };
  }
}

function detectRequestedFacts(
  normalizedQuestion: string,
  requestedColor: string | null,
  requestedSize: string | null,
): ProductAnswerFact[] {
  const facts: ProductAnswerFact[] = [];

  if (
    requestedColor ||
    requestedSize ||
    includesAny(normalizedQuestion, STOCK_PATTERNS)
  ) {
    facts.push('STOCK');
  }
  if (includesAny(normalizedQuestion, PRICE_PATTERNS)) facts.push('PRICE');
  if (includesAny(normalizedQuestion, MATERIAL_PATTERNS)) {
    facts.push('MATERIAL');
  }
  if (includesAny(normalizedQuestion, DURABILITY_PATTERNS)) {
    facts.push('DURABILITY');
  }
  if (includesAny(normalizedQuestion, SHIPPING_PATTERNS)) {
    facts.push('SHIPPING');
  }
  if (facts.length === 0) facts.push('PRODUCT_INFO');

  return facts;
}

function findRelevantAttributes(
  normalizedQuestion: string,
  attributes: Array<{ name: string; value: string }>,
) {
  const questionTokens = new Set(
    normalizedQuestion
      .split(' ')
      .filter(
        (token) => token.length > 2 && !IGNORED_ATTRIBUTE_TOKENS.has(token),
      ),
  );

  return attributes.filter((attribute) => {
    const attributeTokens = normalizeSearchValue(
      `${attribute.name} ${attribute.value}`,
    ).split(' ');

    return attributeTokens.some((token) => questionTokens.has(token));
  });
}

function findGenericSizeMention(normalizedQuestion: string) {
  const letterSize = normalizedQuestion.match(
    /(?:^| )(xxs|xs|s|m|l|xl|xxl|xxxl|standart)(?: |$)/,
  )?.[1];

  if (letterSize) return letterSize.toLocaleUpperCase('tr-TR');

  const numericSize = normalizedQuestion.match(
    /(?:^| )(\d{2,3})(?: cm)?(?: |$)/,
  )?.[1];
  const value = numericSize ? Number(numericSize) : null;

  return value !== null && value >= 24 && value <= 120
    ? (numericSize ?? null)
    : null;
}

function findMention(normalizedQuestion: string, values: string[]) {
  return (
    [...values]
      .sort((left, right) => right.length - left.length)
      .find((value) =>
        ` ${normalizedQuestion} `.includes(` ${normalizeSearchValue(value)} `),
      ) ?? null
  );
}

function findEquivalentValue(value: string | null, availableValues: string[]) {
  if (!value) return null;
  return (
    availableValues.find((candidate) => sameValue(candidate, value)) ?? null
  );
}

function sameValue(left: string | null, right: string | null) {
  return Boolean(
    left && right && normalizeSearchValue(left) === normalizeSearchValue(right),
  );
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function uniqueValues(values: Array<string | null>) {
  return [
    ...new Map(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => [normalizeSearchValue(value), value]),
    ).values(),
  ];
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isSellableVariant(
  variant: ProductAnswerContext['matchingVariants'][number],
) {
  return variant.status === ProductVariantStatus.ACTIVE && variant.stock > 0;
}
