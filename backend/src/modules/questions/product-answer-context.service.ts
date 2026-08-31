import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductQuestionStatus,
  ProductVariantStatus,
  QuestionAnswerStatus,
  SizeGuideStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type {
  ProductAnswerContext,
  ProductAnswerEvidence,
  ProductAnswerFact,
} from './product-answer-context.types';

const STOCK_PATTERNS = [
  'stok',
  'stokta',
  'mevcut mu',
  'kaldi mi',
  'bulunuyor mu',
  'satista mi',
];
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
const SIZE_PATTERNS = [
  'beden',
  'numara',
  'boyum',
  'kiloyum',
  'kilo',
  'gogus',
  'bel olc',
  'beden tablosu',
  'kac cm',
  'olcu',
  'olcusu',
  'ic bacak',
];
const COLOR_PATTERNS = [
  'hangi renk',
  'renk secenegi',
  'renkleri neler',
  'baska renk',
  'rengi mevcut',
];
const FIT_PATTERNS = [
  'kalip',
  'slim',
  'regular',
  'oversize',
  'boxy',
  'relax',
  'bol dur',
  'dar dur',
];
const CARE_PATTERNS = [
  'yikama',
  'yikan',
  'bakim',
  'utulen',
  'kurutma',
  'cekme yap',
];
const PRODUCT_CODE_PATTERNS = [
  'urun kodu',
  'urun kodunu',
  'model kodu',
  'model kodunu',
];
const PRODUCT_INFO_PATTERNS = [
  'astar',
  'ic goster',
  'olcu',
  'boyu',
  'uzunluk',
  'hacim',
  'cep',
  'aski',
  'cikaril',
  'paket',
  'kutu',
  'ayarlan',
];
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
            sizeGuides: {
              where: {
                status: SizeGuideStatus.READY,
                normalizedText: { not: null },
              },
              orderBy: { analyzedAt: 'desc' },
              select: {
                id: true,
                sourceUrl: true,
                normalizedText: true,
                confidence: true,
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

    const variants = question.product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
    }));
    return analyzeProductQuestion({
      questionId: question.id,
      question: question.question,
      product: {
        id: question.product.id,
        title: question.product.title,
        description: question.product.description,
        attributes: question.product.attributes,
        variants,
        sizeGuides: question.product.sizeGuides.flatMap((guide) =>
          guide.normalizedText
            ? [{ ...guide, normalizedText: guide.normalizedText }]
            : [],
        ),
      },
    });
  }
}

export function analyzeProductQuestion(input: {
  questionId: string;
  question: string;
  product: ProductAnswerContext['product'];
}): ProductAnswerContext {
  const normalizedQuestion = normalizeSearchValue(input.question);
  const variants = input.product.variants;
  const availableColors = uniqueValues(
    variants.map((variant) => variant.color),
  );
  const availableSizes = uniqueValues(variants.map((variant) => variant.size));
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
  const requestedFacts = detectRequestedFacts(normalizedQuestion);
  const relevantAttributes = findRelevantAttributes(
    normalizedQuestion,
    requestedFacts,
    input.product.attributes,
  );
  const relevantDescription = findRelevantDescription(
    input.product.description,
    normalizedQuestion,
    requestedFacts,
  );
  const evidence = createEvidence({
    productTitle: input.product.title,
    requestedFacts,
    relevantAttributes,
    relevantDescription,
    matchingVariants,
    variants,
    requestedColor,
    requestedSize,
    matchedColor,
    matchedSize,
    sizeGuides: input.product.sizeGuides ?? [],
    normalizedQuestion,
  });

  return {
    questionId: input.questionId,
    question: input.question,
    requestedFacts,
    requestedColor,
    requestedSize,
    matchedColor,
    matchedSize,
    product: input.product,
    matchingVariants,
    relevantAttributes,
    relevantDescription,
    evidence,
  };
}

function detectRequestedFacts(normalizedQuestion: string): ProductAnswerFact[] {
  const facts: ProductAnswerFact[] = [];

  if (isStockQuestion(normalizedQuestion)) {
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
  if (includesAny(normalizedQuestion, SIZE_PATTERNS)) facts.push('SIZE');
  if (isColorQuestion(normalizedQuestion)) facts.push('COLOR');
  if (includesAny(normalizedQuestion, FIT_PATTERNS)) facts.push('FIT');
  if (includesAny(normalizedQuestion, CARE_PATTERNS)) facts.push('CARE');
  if (includesAny(normalizedQuestion, PRODUCT_CODE_PATTERNS)) {
    facts.push('PRODUCT_CODE');
  }
  if (includesAny(normalizedQuestion, PRODUCT_INFO_PATTERNS)) {
    facts.push('PRODUCT_INFO');
  }
  if (facts.length === 0) facts.push('PRODUCT_INFO');

  return facts;
}

function isColorQuestion(normalizedQuestion: string) {
  if (includesAny(normalizedQuestion, COLOR_PATTERNS)) return true;

  return COMMON_COLORS.some((color) => {
    const normalizedColor = normalizeSearchValue(color);
    return new RegExp(
      `(?:^| )${escapeRegExp(normalizedColor)}(?: rengi| renk)? (?:var mi|mevcut mu)(?: |$)`,
    ).test(normalizedQuestion);
  });
}

function isStockQuestion(normalizedQuestion: string) {
  if (includesAny(normalizedQuestion, STOCK_PATTERNS)) return true;

  return /(?:^| )(?:urun|renk|rengi|beden|numara|varyant) (?:var mi|mevcut mu)(?: |$)/.test(
    normalizedQuestion,
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findRelevantAttributes(
  normalizedQuestion: string,
  requestedFacts: ProductAnswerFact[],
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
    const normalizedAttribute = normalizeSearchValue(
      `${attribute.name} ${attribute.value}`,
    );
    const attributeTokens = normalizedAttribute.split(' ');

    return (
      attributeTokens.some((token) => questionTokens.has(token)) ||
      requestedFacts.some((fact) =>
        attributePatternsForFact(fact).some((pattern) =>
          normalizedAttribute.includes(pattern),
        ),
      )
    );
  });
}

const ATTRIBUTE_PATTERNS_BY_FACT: Record<ProductAnswerFact, string[]> = {
  STOCK: ['stok', 'adet'],
  PRICE: ['fiyat', 'tl', 'ucret'],
  MATERIAL: ['materyal', 'kumas', 'dokuma', 'deri', 'pamuk', 'polyester'],
  DURABILITY: [
    'kararma',
    'solma',
    'paslan',
    'soyul',
    'dayanik',
    'su gecir',
    'su itici',
    'ic goster',
  ],
  SHIPPING: ['kargo', 'teslim', 'gonderim'],
  SIZE: ['beden', 'olcu', 'uzunluk', 'gogus', 'bel', 'basen', 'numara'],
  COLOR: ['renk'],
  FIT: ['kalip', 'siluet', 'slim', 'regular', 'oversize', 'boxy', 'relax'],
  CARE: ['yikama', 'bakim', 'kurut', 'utu', 'temizle'],
  PRODUCT_CODE: ['urun kod', 'model kod', 'stok kod'],
  PRODUCT_INFO: [
    'yaka',
    'kol',
    'cep',
    'astar',
    'kapama',
    'desen',
    'paket',
    'kutu',
  ],
};

function attributePatternsForFact(fact: ProductAnswerFact) {
  return ATTRIBUTE_PATTERNS_BY_FACT[fact];
}

function findRelevantDescription(
  description: string | null,
  normalizedQuestion: string,
  requestedFacts: ProductAnswerFact[],
) {
  if (!description) return null;

  const questionTokens = normalizedQuestion
    .split(' ')
    .filter(
      (token) => token.length > 3 && !IGNORED_ATTRIBUTE_TOKENS.has(token),
    );
  const segments = description
    .split(/\n+|(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const relevant = segments.filter((segment) => {
    const normalizedSegment = normalizeSearchValue(segment);
    return (
      questionTokens.some((token) => normalizedSegment.includes(token)) ||
      requestedFacts.some((fact) =>
        attributePatternsForFact(fact).some((pattern) =>
          normalizedSegment.includes(pattern),
        ),
      )
    );
  });

  const selected = (relevant.length > 0 ? relevant : segments.slice(0, 2))
    .slice(0, 8)
    .join('\n');
  return selected.slice(0, 1_800) || null;
}

function createEvidence(input: {
  productTitle: string;
  requestedFacts: ProductAnswerFact[];
  relevantAttributes: Array<{ name: string; value: string }>;
  relevantDescription: string | null;
  matchingVariants: ProductAnswerContext['matchingVariants'];
  variants: ProductAnswerContext['product']['variants'];
  requestedColor: string | null;
  requestedSize: string | null;
  matchedColor: string | null;
  matchedSize: string | null;
  sizeGuides: NonNullable<ProductAnswerContext['product']['sizeGuides']>;
  normalizedQuestion: string;
}): ProductAnswerEvidence[] {
  const evidence: ProductAnswerEvidence[] = [];

  if (input.requestedFacts.includes('PRODUCT_CODE')) {
    const productCode = extractProductCode(input.productTitle);
    if (productCode) {
      evidence.push({
        id: 'title-product-code',
        fact: 'PRODUCT_CODE',
        label: 'Ürün kodu',
        value: productCode,
        source: 'TITLE',
      });
    }
  }

  input.relevantAttributes.forEach((attribute, index) => {
    const normalizedAttribute = normalizeSearchValue(
      `${attribute.name} ${attribute.value}`,
    );
    const matchingFacts = input.requestedFacts.filter((fact) =>
      attributePatternsForFact(fact).some((pattern) =>
        normalizedAttribute.includes(pattern),
      ),
    );
    const facts: ProductAnswerFact[] =
      matchingFacts.length > 0 ? matchingFacts : ['PRODUCT_INFO'];
    for (const fact of facts) {
      evidence.push({
        id: `attribute-${index + 1}-${fact.toLocaleLowerCase('tr-TR')}`,
        fact,
        label: attribute.name,
        value: attribute.value,
        source: 'ATTRIBUTE',
      });
    }
  });

  if (input.relevantDescription) {
    for (const fact of input.requestedFacts.filter(
      (candidate) => candidate !== 'STOCK' && candidate !== 'PRICE',
    )) {
      if (
        attributePatternsForFact(fact).some((pattern) =>
          normalizeSearchValue(input.relevantDescription ?? '').includes(
            pattern,
          ),
        )
      ) {
        evidence.push({
          id: `description-${fact.toLocaleLowerCase('tr-TR')}`,
          fact,
          label: 'Ürün açıklaması',
          value: input.relevantDescription,
          source: 'DESCRIPTION',
        });
      }
    }
  }

  if (input.requestedFacts.includes('STOCK')) {
    const variants = input.matchingVariants;
    evidence.push({
      id: 'variant-stock',
      fact: 'STOCK',
      label: 'Eşleşen varyant stoğu',
      value:
        variants.length > 0
          ? variants.slice(0, 30).map(formatVariantAvailability).join('; ')
          : 'Soruda istenen renk veya beden ürün varyantlarıyla eşleşmiyor.',
      source: 'VARIANT',
    });
  }

  if (input.requestedFacts.includes('PRICE')) {
    const variants =
      input.matchingVariants.length > 0
        ? input.matchingVariants
        : input.variants;
    evidence.push({
      id: 'variant-price',
      fact: 'PRICE',
      label: 'Varyant fiyatları',
      value:
        variants.length > 0
          ? variants
              .slice(0, 30)
              .map(
                (variant) =>
                  `${variantLabel(variant)}: ${variant.price} ${variant.currency}`,
              )
              .join('; ')
          : 'Fiyatı doğrulanabilecek varyant bulunmuyor.',
      source: 'VARIANT',
    });
  }

  if (input.requestedFacts.includes('SIZE')) {
    const sizes = uniqueValues(input.variants.map((variant) => variant.size));
    evidence.push({
      id: 'variant-sizes',
      fact: 'SIZE',
      label: 'Beden seçenekleri',
      value: [
        sizes.length > 0 ? sizes.join(', ') : 'Beden seçeneği belirtilmemiş.',
        input.requestedSize
          ? input.matchedSize
            ? `İstenen beden eşleşti: ${input.matchedSize}.`
            : `İstenen beden eşleşmedi: ${input.requestedSize}.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      source: 'VARIANT',
    });

    for (const guide of input.sizeGuides.slice(0, 2)) {
      evidence.push({
        id: `size-guide-${guide.id}`,
        fact: 'SIZE',
        label: 'Beden ve ölçü tablosu',
        value: selectSizeGuideEvidence(
          guide.normalizedText,
          input.normalizedQuestion,
          input.requestedSize,
        ),
        source: 'SIZE_GUIDE',
        confidence: guide.confidence ?? undefined,
      });
    }
  }

  if (input.requestedFacts.includes('COLOR')) {
    const colors = uniqueValues(input.variants.map((variant) => variant.color));
    evidence.push({
      id: 'variant-colors',
      fact: 'COLOR',
      label: 'Renk seçenekleri',
      value: [
        colors.length > 0 ? colors.join(', ') : 'Renk seçeneği belirtilmemiş.',
        input.requestedColor
          ? input.matchedColor
            ? `İstenen renk eşleşti: ${input.matchedColor}.`
            : `İstenen renk eşleşmedi: ${input.requestedColor}.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      source: 'VARIANT',
    });
  }

  return [...new Map(evidence.map((item) => [item.id, item])).values()];
}

function selectSizeGuideEvidence(
  text: string,
  normalizedQuestion: string,
  requestedSize: string | null,
) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const measurementTokens = [
    'bel',
    'basen',
    'gogus',
    'boy',
    'uzunluk',
    'ic bacak',
    'paca',
    'omuz',
    'kol',
    'kilo',
  ].filter((token) => normalizedQuestion.includes(token));
  const normalizedSize = requestedSize
    ? normalizeSearchValue(requestedSize)
    : null;
  const matchingRows = lines.filter((line) => {
    const normalizedLine = normalizeSearchValue(line);
    const sizeMatches = normalizedSize
      ? normalizedLine.includes(`beden ${normalizedSize}`)
      : true;
    const measurementMatches = measurementTokens.length
      ? measurementTokens.some((token) => normalizedLine.includes(token))
      : true;
    return sizeMatches && measurementMatches;
  });
  const selected = matchingRows.length
    ? [...lines.slice(0, 2), ...matchingRows]
    : lines;

  return [...new Set(selected)].join('\n').slice(0, 6_000);
}

export function extractProductCode(title: string) {
  const candidates = title.match(
    /\b(?=[a-z0-9-]{5,}\b)(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9-]+\b/gi,
  );

  return candidates?.at(-1) ?? null;
}

function formatVariantAvailability(
  variant: ProductAnswerContext['matchingVariants'][number],
) {
  return `${variantLabel(variant)}: ${variant.status === ProductVariantStatus.ACTIVE && variant.stock > 0 ? 'stokta' : 'stokta yok'}`;
}

function variantLabel(
  variant: ProductAnswerContext['matchingVariants'][number],
) {
  return (
    [variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku
  );
}

function findGenericSizeMention(normalizedQuestion: string) {
  const letterSize = normalizedQuestion.match(
    /(?:^| )(xxs|xs|s|m|l|xl|xxl|xxxl|standart)(?: |$)/,
  )?.[1];

  if (letterSize) return letterSize.toLocaleUpperCase('tr-TR');

  const numericSizeMatch = normalizedQuestion.match(
    /(?:^| )(?:beden|numara) (\d{2,3})(?: |$)|(?:^| )(\d{2,3}) (?:beden|numara)(?: |$)/,
  );
  const numericSize = numericSizeMatch?.[1] ?? numericSizeMatch?.[2];
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
