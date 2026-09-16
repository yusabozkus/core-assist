import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalEntityStatus,
  ProductQuestionStatus,
  ProductVariantStatus,
  QuestionAnswerComposition,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  SizeGuideStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  getInventoryFreshnessCutoff,
  getInventoryFreshnessMaxAgeMs,
  resolveInventoryFreshness,
} from '../catalog/inventory-freshness';
import {
  applyHeightWeightSizeRecommendation,
  parseProductAnswerSizeGuideData,
} from './height-weight-size-recommendation';
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
const MATERIAL_PATTERNS = [
  'materyal',
  'malzeme',
  'kumas',
  'deri mi',
  'pamuk',
  'ribana',
  'ribanali',
  'rikla',
  'riklali',
  'likra',
  'likrali',
  'elastan',
  'esnek',
];
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
const RETURN_PATTERNS = ['iade', 'geri gonder', 'geri gönder'];
const EXCHANGE_PATTERNS = ['degisim', 'değişim', 'degistir', 'değiştir'];
const WARRANTY_PATTERNS = ['garanti', 'garantili'];
const SIZE_PATTERNS = [
  'beden',
  'numara',
  'boyum',
  'kiloyum',
  'kilo',
  'gogus',
  'bel olc',
  'beden tablosu',
  'b den tablo',
  'kac cm',
  'olcu',
  'olcusu',
  'ic bacak',
];
const COLOR_PATTERNS = [
  'hangi renk',
  'urun rengi',
  'rengi nedir',
  'renk nedir',
  'renk secenegi',
  'renkleri neler',
  'baska renk',
  'rengi mevcut',
];
const FIT_PATTERNS = [
  'kalip',
  'kalib',
  'kesim',
  'slim',
  'regular',
  'oversize',
  'boxy',
  'relax',
  'bol dur',
  'dar dur',
  'bol mu',
  'dar mi',
  'genis mi',
  'standart kesim',
  'normal kesim',
  'rahat kesim',
  'vucuda otur',
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
        externalProductRecordId: true,
        connection: {
          select: { providerKey: true },
        },
        store: {
          select: {
            knowledgeProfile: {
              select: {
                brandDescription: true,
                shippingPolicy: true,
                returnPolicy: true,
                exchangePolicy: true,
                warrantyPolicy: true,
                additionalInformation: true,
                tone: true,
                responseLength: true,
                greetingEnabled: true,
                closingEnabled: true,
                emojiPolicy: true,
                preferredEmoji: true,
                emojiEnabled: true,
                automationMode: true,
                minimumAutoSendConfidence: true,
                heightWeightSizeRecommendationEnabled: true,
              },
            },
            knowledgeFaqs: {
              where: { active: true },
              orderBy: { position: 'asc' },
              take: 12,
              select: { question: true, answer: true },
            },
            aiInstructions: {
              where: { active: true },
              orderBy: { priority: 'asc' },
              take: 20,
              select: { content: true },
            },
            channelKnowledge: {
              select: {
                providerKey: true,
                shippingPolicy: true,
                returnPolicy: true,
                exchangePolicy: true,
                warrantyPolicy: true,
                additionalInformation: true,
              },
            },
            productQuestions: {
              where: {
                id: { not: questionId },
                status: ProductQuestionStatus.ANSWERED,
                answer: { not: null },
                answerDelivery: {
                  is: {
                    status: QuestionAnswerStatus.SENT,
                    origin: QuestionAnswerOrigin.MANUAL,
                  },
                },
              },
              orderBy: { answeredAt: 'desc' },
              take: 12,
              select: {
                question: true,
                answer: true,
                connection: { select: { providerKey: true } },
                answerDelivery: { select: { composition: true } },
              },
            },
          },
        },
        answerDelivery: {
          select: { status: true },
        },
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            brand: true,
            category: true,
            attributes: {
              orderBy: { name: 'asc' },
              select: { name: true, value: true },
            },
            knowledgeFacts: {
              where: { status: 'VERIFIED' },
              orderBy: { verifiedAt: 'desc' },
              take: 50,
              select: {
                id: true,
                factType: true,
                label: true,
                value: true,
                variant: {
                  select: { sku: true, size: true, color: true },
                },
              },
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
                lastSyncedAt: true,
                externalVariants: {
                  select: {
                    externalProductId: true,
                    price: true,
                    currency: true,
                    stock: true,
                    status: true,
                    lastSyncedAt: true,
                  },
                },
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
                structuredData: true,
                confidence: true,
                externalProductId: true,
              },
            },
            questions: {
              where: {
                id: { not: questionId },
                status: ProductQuestionStatus.ANSWERED,
                answer: { not: null },
                answerDelivery: {
                  is: {
                    status: QuestionAnswerStatus.SENT,
                    origin: QuestionAnswerOrigin.MANUAL,
                  },
                },
              },
              orderBy: { answeredAt: 'desc' },
              take: 5,
              select: {
                question: true,
                answer: true,
                connection: { select: { providerKey: true } },
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

    const variants = question.product.variants
      .filter(
        (variant) =>
          !question.externalProductRecordId ||
          variant.externalVariants.some(
            (externalVariant) =>
              externalVariant.externalProductId ===
              question.externalProductRecordId,
          ),
      )
      .map((variant) => {
        const channelVariant = question.externalProductRecordId
          ? variant.externalVariants.find(
              (externalVariant) =>
                externalVariant.externalProductId ===
                question.externalProductRecordId,
            )
          : null;
        const stock = channelVariant?.stock ?? variant.stock;

        return {
          title: variant.title,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          price: Number(channelVariant?.price ?? variant.price),
          currency: channelVariant?.currency ?? variant.currency,
          stock,
          status:
            channelVariant &&
            channelVariant.status !== ExternalEntityStatus.ACTIVE
              ? ProductVariantStatus.UNAVAILABLE
              : stock > 0
                ? ProductVariantStatus.ACTIVE
                : ProductVariantStatus.OUT_OF_STOCK,
          lastSyncedAt:
            (
              channelVariant?.lastSyncedAt ?? variant.lastSyncedAt
            )?.toISOString() ?? null,
        };
      });
    const context = applyVerifiedProductKnowledge(
      analyzeProductQuestion({
        questionId: question.id,
        question: question.question,
        providerKey: question.connection.providerKey,
        product: {
          id: question.product.id,
          title: question.product.title,
          description: question.product.description,
          brand: question.product.brand,
          category: question.product.category,
          attributes: question.product.attributes,
          variants,
          sizeGuides: question.product.sizeGuides.flatMap((guide) => {
            const belongsToQuestionSource =
              !question.externalProductRecordId ||
              !guide.externalProductId ||
              guide.externalProductId === question.externalProductRecordId;

            if (!belongsToQuestionSource || !guide.normalizedText) return [];

            return [
              {
                id: guide.id,
                sourceUrl: guide.sourceUrl,
                normalizedText: guide.normalizedText,
                confidence: guide.confidence,
                structuredData: parseProductAnswerSizeGuideData(
                  guide.structuredData,
                ),
              },
            ];
          }),
        },
      }),
      question.product.knowledgeFacts,
    );

    const approvedAnswerExamples = buildApprovedAnswerExamples({
      providerKey: question.connection.providerKey,
      productExamples: question.product.questions,
      storeExamples: question.store.productQuestions,
    });

    return applyHeightWeightSizeRecommendation(
      applyStoreKnowledge(
        context,
        question.store,
        question.connection.providerKey,
        approvedAnswerExamples,
      ),
    );
  }
}

function applyVerifiedProductKnowledge(
  context: ProductAnswerContext,
  facts: Array<{
    id: string;
    factType:
      | 'MATERIAL'
      | 'DURABILITY'
      | 'SIZE'
      | 'COLOR'
      | 'FIT'
      | 'CARE'
      | 'PRODUCT_INFO';
    label: string;
    value: string;
    variant: {
      sku: string;
      size: string | null;
      color: string | null;
    } | null;
  }>,
): ProductAnswerContext {
  const evidence = [...context.evidence];

  for (const fact of facts) {
    if (fact.variant && !verifiedFactMatchesVariant(context, fact.variant)) {
      continue;
    }

    evidence.push({
      id: `merchant-verified-${fact.id}`,
      fact: fact.factType,
      label: fact.variant ? `${fact.label} (seçili varyant)` : fact.label,
      value: fact.value,
      source: 'MERCHANT_VERIFIED',
      confidence: 1,
    });
  }

  return { ...context, evidence };
}

function verifiedFactMatchesVariant(
  context: ProductAnswerContext,
  variant: { sku: string; size: string | null; color: string | null },
) {
  const hasDescriptiveScope = Boolean(variant.size || variant.color);
  if (!hasDescriptiveScope) {
    const normalizedQuestion = ` ${normalizeSearchValue(context.question)} `;
    const normalizedSku = normalizeSearchValue(variant.sku);
    return Boolean(
      normalizedSku && normalizedQuestion.includes(` ${normalizedSku} `),
    );
  }

  if (variant.size) {
    if (!context.matchedSize || !sameValue(variant.size, context.matchedSize)) {
      return false;
    }
  }
  if (variant.color) {
    if (
      !context.matchedColor ||
      !sameValue(variant.color, context.matchedColor)
    ) {
      return false;
    }
  }

  return true;
}

type StoreKnowledgeInput = {
  knowledgeProfile: {
    brandDescription: string | null;
    shippingPolicy: string | null;
    returnPolicy: string | null;
    exchangePolicy: string | null;
    warrantyPolicy: string | null;
    additionalInformation: string | null;
    tone: 'PROFESSIONAL' | 'FRIENDLY' | 'WARM' | 'MINIMAL';
    responseLength: 'SHORT' | 'BALANCED' | 'DETAILED';
    greetingEnabled: boolean;
    closingEnabled: boolean;
    emojiPolicy: 'NEVER' | 'WHEN_APPROPRIATE' | 'ALWAYS';
    preferredEmoji: string | null;
    emojiEnabled: boolean;
    automationMode: 'OFF' | 'SHADOW' | 'SAFE_AUTO';
    minimumAutoSendConfidence: number;
    heightWeightSizeRecommendationEnabled: boolean;
  } | null;
  knowledgeFaqs: Array<{ question: string; answer: string }>;
  aiInstructions: Array<{ content: string }>;
  channelKnowledge: Array<{
    providerKey: string;
    shippingPolicy: string | null;
    returnPolicy: string | null;
    exchangePolicy: string | null;
    warrantyPolicy: string | null;
    additionalInformation: string | null;
  }>;
  productQuestions: Array<{
    question: string;
    answer: string | null;
    connection: { providerKey: string };
    answerDelivery: { composition: QuestionAnswerComposition } | null;
  }>;
};

function buildApprovedAnswerExamples({
  providerKey,
  productExamples,
  storeExamples,
}: {
  providerKey: string;
  productExamples: Array<{
    question: string;
    answer: string | null;
    connection: { providerKey: string };
  }>;
  storeExamples: StoreKnowledgeInput['productQuestions'];
}) {
  const rankedStoreExamples = [...storeExamples].sort((left, right) => {
    const providerDifference =
      Number(right.connection.providerKey === providerKey) -
      Number(left.connection.providerKey === providerKey);
    if (providerDifference !== 0) return providerDifference;

    return (
      compositionPriority(right.answerDelivery?.composition) -
      compositionPriority(left.answerDelivery?.composition)
    );
  });
  const seen = new Set<string>();

  const providerProductExamples = productExamples.filter(
    (item) => item.connection.providerKey === providerKey,
  );

  return [...providerProductExamples, ...rankedStoreExamples]
    .flatMap((item) =>
      item.answer ? [{ question: item.question, answer: item.answer }] : [],
    )
    .filter((item) => {
      const key = `${item.question.trim()}\u0000${item.answer.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function compositionPriority(
  composition: QuestionAnswerComposition | undefined,
) {
  switch (composition) {
    case QuestionAnswerComposition.AI_EDITED:
      return 3;
    case QuestionAnswerComposition.MANUAL:
      return 2;
    case QuestionAnswerComposition.AI_UNCHANGED:
      return 1;
    default:
      return 0;
  }
}

function applyStoreKnowledge(
  context: ProductAnswerContext,
  store: StoreKnowledgeInput,
  providerKey: string,
  approvedAnswerExamples: Array<{ question: string; answer: string }>,
): ProductAnswerContext {
  const profile = store.knowledgeProfile;
  const override = store.channelKnowledge.find(
    (item) => item.providerKey === providerKey,
  );
  const evidence = [...context.evidence];
  const add = (
    id: string,
    fact: ProductAnswerFact,
    label: string,
    value: string | null | undefined,
    source: 'STORE_KNOWLEDGE' | 'CHANNEL_OVERRIDE',
  ) => {
    if (!value?.trim()) return;
    evidence.push({ id, fact, label, value: value.trim(), source });
  };
  const resolved = (
    key:
      | 'shippingPolicy'
      | 'returnPolicy'
      | 'exchangePolicy'
      | 'warrantyPolicy'
      | 'additionalInformation',
  ) => override?.[key]?.trim() || profile?.[key] || null;
  const source = (key: Parameters<typeof resolved>[0]) =>
    override?.[key]?.trim() ? 'CHANNEL_OVERRIDE' : 'STORE_KNOWLEDGE';

  add(
    'store-brand-description',
    'PRODUCT_INFO',
    'Mağaza ve marka bilgisi',
    profile?.brandDescription,
    'STORE_KNOWLEDGE',
  );
  add(
    'store-shipping-policy',
    'SHIPPING',
    'Kargo ve teslimat politikası',
    resolved('shippingPolicy'),
    source('shippingPolicy'),
  );
  add(
    'store-return-policy',
    'RETURN',
    'İade politikası',
    resolved('returnPolicy'),
    source('returnPolicy'),
  );
  add(
    'store-exchange-policy',
    'EXCHANGE',
    'Değişim politikası',
    resolved('exchangePolicy'),
    source('exchangePolicy'),
  );
  add(
    'store-warranty-policy',
    'WARRANTY',
    'Garanti politikası',
    resolved('warrantyPolicy'),
    source('warrantyPolicy'),
  );
  add(
    'store-additional-information',
    'PRODUCT_INFO',
    'Mağazanın ek yanıt bilgileri',
    resolved('additionalInformation'),
    source('additionalInformation'),
  );
  store.knowledgeFaqs.forEach((faq, index) => {
    evidence.push({
      id: `store-faq-${index + 1}`,
      fact: 'PRODUCT_INFO',
      label: `SSS: ${faq.question}`,
      value: faq.answer,
      source: 'FAQ',
    });
  });

  return {
    ...context,
    evidence,
    responsePreferences: {
      automationMode: profile?.automationMode ?? 'OFF',
      minimumAutoSendConfidence: profile?.minimumAutoSendConfidence ?? 0.85,
      tone: profile?.tone ?? 'PROFESSIONAL',
      responseLength: profile?.responseLength ?? 'BALANCED',
      greetingEnabled: profile?.greetingEnabled ?? true,
      closingEnabled: profile?.closingEnabled ?? true,
      emojiPolicy:
        profile?.emojiPolicy === 'NEVER' && profile.emojiEnabled
          ? 'ALWAYS'
          : (profile?.emojiPolicy ?? 'NEVER'),
      preferredEmoji: profile?.preferredEmoji ?? null,
      heightWeightSizeRecommendationEnabled:
        profile?.heightWeightSizeRecommendationEnabled ?? false,
      instructions: store.aiInstructions.map((item) => item.content),
      approvedAnswerExamples,
    },
  };
}

export function analyzeProductQuestion(input: {
  questionId: string;
  question: string;
  providerKey?: string;
  product: ProductAnswerContext['product'];
  additionalRequestedFacts?: ProductAnswerFact[];
}): ProductAnswerContext {
  const normalizedQuestion = normalizeSearchValue(input.question);
  const variants = input.product.variants;
  const availableColors = uniqueValues(
    variants.map((variant) => variant.color),
  );
  const availableSizes = uniqueValues(variants.map((variant) => variant.size));
  const mentionedColors = findMentions(
    normalizedQuestion,
    uniqueValues([...availableColors, ...COMMON_COLORS]),
  );
  const colorIdentityQuestion = isColorQuestion(normalizedQuestion);
  const matchedMentionedColor = mentionedColors.find((color) =>
    Boolean(findEquivalentValue(color, availableColors)),
  );
  const requestedColor =
    matchedMentionedColor ??
    (!colorIdentityQuestion || isStockQuestion(normalizedQuestion)
      ? (mentionedColors[0] ?? null)
      : null);
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
  const requestedFacts = [
    ...new Set([
      ...detectRequestedFacts(normalizedQuestion),
      ...(input.additionalRequestedFacts ?? []),
    ]),
  ];
  const inventoryFreshness = evaluateInventoryFreshness(
    matchingVariants.length > 0 ? matchingVariants : variants,
  );
  const matchedAttributes = findRelevantAttributes(
    normalizedQuestion,
    requestedFacts,
    input.product.attributes,
  );
  const relevantAttributes =
    matchedAttributes.length > 0
      ? matchedAttributes
      : requestedFacts.length === 1 && requestedFacts[0] === 'PRODUCT_INFO'
        ? selectCoreProductAttributes(input.product.attributes)
        : matchedAttributes;
  const relevantDescription = findRelevantDescription(
    input.product.description,
    normalizedQuestion,
    requestedFacts,
  );
  const evidence = createEvidence({
    productTitle: input.product.title,
    productDescription: input.product.description,
    productBrand: input.product.brand,
    productCategory: input.product.category,
    productAttributes: input.product.attributes,
    providerKey: input.providerKey ?? 'unknown',
    requestedFacts,
    relevantAttributes: matchedAttributes,
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
    providerKey: input.providerKey ?? 'unknown',
    requestedFacts,
    mentionedColors,
    requestedColor,
    requestedSize,
    matchedColor,
    matchedSize,
    product: input.product,
    matchingVariants,
    inventoryFreshness,
    relevantAttributes,
    relevantDescription,
    evidence,
  };
}

function evaluateInventoryFreshness(
  variants: ProductAnswerContext['product']['variants'],
): ProductAnswerContext['inventoryFreshness'] {
  const cutoff = getInventoryFreshnessCutoff();
  const freshness = variants.map((variant) =>
    resolveInventoryFreshness(
      variant.lastSyncedAt ? new Date(variant.lastSyncedAt) : null,
      cutoff,
    ),
  );
  const syncedDates = variants
    .flatMap((variant) =>
      variant.lastSyncedAt ? [new Date(variant.lastSyncedAt)] : [],
    )
    .filter((date) => Number.isFinite(date.getTime()));
  const latestSyncedAt = syncedDates.length
    ? new Date(
        Math.max(...syncedDates.map((date) => date.getTime())),
      ).toISOString()
    : null;

  return {
    status:
      freshness.length > 0 && freshness.every((item) => item === 'FRESH')
        ? 'FRESH'
        : freshness.some((item) => item === 'STALE')
          ? 'STALE'
          : 'UNKNOWN',
    latestSyncedAt,
    maxAgeMs: getInventoryFreshnessMaxAgeMs(),
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
  if (includesAny(normalizedQuestion, RETURN_PATTERNS)) facts.push('RETURN');
  if (includesAny(normalizedQuestion, EXCHANGE_PATTERNS)) {
    facts.push('EXCHANGE');
  }
  if (includesAny(normalizedQuestion, WARRANTY_PATTERNS)) {
    facts.push('WARRANTY');
  }
  if (
    includesAny(normalizedQuestion, SIZE_PATTERNS) ||
    /(?:^| )kg(?: |$)/.test(normalizedQuestion) ||
    Boolean(findGenericSizeMention(normalizedQuestion))
  ) {
    facts.push('SIZE');
  }
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
  if (/\b(?:renk|rengi)\b.*\b(?:mi|mu)\b/.test(normalizedQuestion)) {
    return true;
  }

  return COMMON_COLORS.some((color) => {
    const normalizedColor = normalizeSearchValue(color);
    return new RegExp(
      `(?:^| )${escapeRegExp(normalizedColor)}(?: rengi| renk)? (?:var mi|mevcut mu)(?: |$)`,
    ).test(normalizedQuestion);
  });
}

function isStockQuestion(normalizedQuestion: string) {
  if (includesAny(normalizedQuestion, STOCK_PATTERNS)) return true;

  if (
    /(?:^| )(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|\d{2,3})(?: beden| bedeni| numara)? (?:var ?mi|mevcut|bulunur|kalmis)(?: |$)/.test(
      normalizedQuestion,
    )
  ) {
    return true;
  }
  if (
    COMMON_COLORS.some((color) =>
      new RegExp(
        `(?:^| )${escapeRegExp(normalizeSearchValue(color))}(?:i|si| rengi| renk)? (?:var ?mi|mevcut|bulunur)(?: |$)`,
      ).test(normalizedQuestion),
    )
  ) {
    return true;
  }

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
  MATERIAL: [
    'materyal',
    'kumas',
    'dokuma',
    'deri',
    'pamuk',
    'polyester',
    'elastan',
    'likra',
    'ribana',
  ],
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
  RETURN: ['iade'],
  EXCHANGE: ['degisim', 'değişim'],
  WARRANTY: ['garanti'],
  SIZE: ['beden', 'olcu', 'uzunluk', 'gogus', 'bel', 'basen', 'numara'],
  COLOR: ['renk'],
  FIT: [
    'kalip',
    'kalib',
    'kesim',
    'fit',
    'siluet',
    'slim',
    'regular',
    'oversize',
    'boxy',
    'relax',
  ],
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

function selectCoreProductAttributes(
  attributes: Array<{ name: string; value: string }>,
) {
  const priorityPatterns = [
    'urun tipi',
    'kalip',
    'siluet',
    'materyal bileseni',
    'materyal',
    'kumas tipi',
    'dokuma tipi',
    'renk',
    'boy',
    'kol boyu',
    'kol tipi',
    'yaka',
    'desen',
    'cep',
    'astar',
    'kapama',
  ];
  const ignoredPatterns = [
    'mensei',
    'kutu durumu',
    'surdurulebilirlik',
    'yurt disi satis',
    'stok adedi',
    'stok kodu',
  ];

  return [...attributes]
    .filter((attribute) => {
      const name = normalizeSearchValue(attribute.name);
      return !ignoredPatterns.some((pattern) => name.includes(pattern));
    })
    .sort((left, right) => {
      const leftName = normalizeSearchValue(left.name);
      const rightName = normalizeSearchValue(right.name);
      const leftPriority = priorityPatterns.findIndex((pattern) =>
        leftName.includes(pattern),
      );
      const rightPriority = priorityPatterns.findIndex((pattern) =>
        rightName.includes(pattern),
      );
      const normalizedLeftPriority =
        leftPriority === -1 ? priorityPatterns.length : leftPriority;
      const normalizedRightPriority =
        rightPriority === -1 ? priorityPatterns.length : rightPriority;
      return normalizedLeftPriority - normalizedRightPriority;
    })
    .slice(0, 12);
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
  productDescription: string | null;
  productBrand: string | null;
  productCategory: string | null;
  productAttributes: Array<{ name: string; value: string }>;
  providerKey: string;
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

  evidence.push({
    id: 'product-identity',
    fact: 'PRODUCT_INFO',
    label: 'Ürün kimliği',
    value: [
      input.productTitle,
      input.productBrand ? `Marka: ${input.productBrand}` : null,
      input.productCategory ? `Kategori: ${input.productCategory}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'TITLE',
    confidence: 1,
  });

  if (input.requestedFacts.includes('PRODUCT_INFO')) {
    const packageScope = inferSingleProductPackageScope({
      title: input.productTitle,
      description: input.productDescription,
      category: input.productCategory,
      normalizedQuestion: input.normalizedQuestion,
    });
    if (packageScope) evidence.push(packageScope);
  }

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

  const semanticAttributes = selectSemanticProductAttributes(
    input.productAttributes,
  );
  if (semanticAttributes.length > 0) {
    evidence.push({
      id: 'catalog-attributes',
      fact: 'PRODUCT_INFO',
      label: 'Ürün özellikleri',
      value: semanticAttributes
        .map((attribute) => `${attribute.name}: ${attribute.value}`)
        .join('\n'),
      source: 'ATTRIBUTE',
    });
  }

  input.relevantAttributes.slice(0, 2).forEach((attribute, index) => {
    const normalizedAttribute = normalizeSearchValue(
      `${attribute.name} ${attribute.value}`,
    );
    const matchingFacts = (
      Object.keys(ATTRIBUTE_PATTERNS_BY_FACT) as ProductAnswerFact[]
    ).filter((fact) =>
      attributePatternsForFact(fact).some((pattern) =>
        normalizedAttribute.includes(pattern),
      ),
    );
    const facts: ProductAnswerFact[] =
      matchingFacts.length > 0 ? matchingFacts : ['PRODUCT_INFO'];
    for (const fact of facts) {
      evidence.push({
        id: `relevant-attribute-${index + 1}-${fact.toLocaleLowerCase('tr-TR')}`,
        fact,
        label: attribute.name,
        value: attribute.value,
        source: 'ATTRIBUTE',
      });
    }
  });

  const descriptionEvidence =
    input.relevantDescription ??
    selectSemanticDescription(input.productDescription);
  if (descriptionEvidence) {
    const matchingDescriptionFact = input.requestedFacts.find(
      (fact) =>
        fact !== 'STOCK' &&
        fact !== 'PRICE' &&
        attributePatternsForFact(fact).some((pattern) =>
          normalizeSearchValue(descriptionEvidence).includes(pattern),
        ),
    );
    const fact = matchingDescriptionFact ?? 'PRODUCT_INFO';
    evidence.push({
      id: `catalog-description-${fact.toLocaleLowerCase('tr-TR')}`,
      fact,
      label: 'Ürün açıklaması',
      value: descriptionEvidence,
      source: 'DESCRIPTION',
    });
  }

  if (input.requestedFacts.includes('STOCK')) {
    const variants =
      input.matchingVariants.length > 0
        ? input.matchingVariants
        : input.variants;
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

  {
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

    if (
      input.requestedFacts.includes('SIZE') &&
      (isSizeGuideLocationQuestion(input.normalizedQuestion) ||
        isHeightWeightSizeQuestion(input.normalizedQuestion))
    ) {
      evidence.push({
        id: 'platform-size-guide-location',
        fact: 'SIZE',
        label: 'Beden tablosunun konumu',
        value: sizeGuideLocationForProvider(input.providerKey),
        source: 'PLATFORM_GUIDANCE',
        confidence: 1,
      });
    }

    for (const guide of input.requestedFacts.includes('SIZE')
      ? input.sizeGuides.slice(0, 2)
      : []) {
      if (
        isProductWidthQuestion(input.normalizedQuestion) &&
        !containsProductWidthMeasurement(guide.normalizedText)
      ) {
        continue;
      }

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

  {
    const colors = uniqueValues(input.variants.map((variant) => variant.color));
    evidence.push({
      id: 'variant-colors',
      fact: 'COLOR',
      label: 'Ürünün katalog rengi',
      value:
        colors.length > 0
          ? colors.join(', ')
          : 'Ürünün katalog rengi belirtilmemiş.',
      source: 'VARIANT',
    });
  }

  return [...new Map(evidence.map((item) => [item.id, item])).values()];
}

function selectSemanticProductAttributes(
  attributes: Array<{ name: string; value: string }>,
) {
  const unique = new Map<string, { name: string; value: string }>();

  for (const attribute of attributes) {
    const name = attribute.name.trim();
    const value = attribute.value.trim();
    if (!name || !value) continue;
    unique.set(`${normalizeSearchValue(name)}:${normalizeSearchValue(value)}`, {
      name,
      value,
    });
  }

  return [...unique.values()].slice(0, 32);
}

function selectSemanticDescription(description: string | null) {
  if (!description) return null;

  const normalized = description.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 3_200) : null;
}

function inferSingleProductPackageScope(input: {
  title: string;
  description: string | null;
  category: string | null;
  normalizedQuestion: string;
}): ProductAnswerEvidence | null {
  if (
    !/(?:geliyor mu|geliyormu|dahil mi|birlikte mi|yaninda mi|icinden mi|takim mi|set mi)/.test(
      input.normalizedQuestion,
    )
  ) {
    return null;
  }

  const requestedItem = [
    'şort',
    'sort',
    'kemer',
    'çanta',
    'canta',
    'pantolon',
    'tişört',
    'tisort',
    'gömlek',
    'gomlek',
    'ceket',
    'etek',
    'aksesuar',
  ].find((item) =>
    input.normalizedQuestion.includes(normalizeSearchValue(item)),
  );
  if (!requestedItem) return null;

  const listing = normalizeSearchValue(
    [input.title, input.description, input.category].filter(Boolean).join(' '),
  );
  const normalizedItem = normalizeSearchValue(requestedItem);
  const titleContainsRequestedItem = normalizeSearchValue(input.title).includes(
    normalizedItem,
  );
  const descriptionContainsRequestedItem = normalizeSearchValue(
    input.description ?? '',
  ).includes(normalizedItem);
  const explicitlyBundled = /\b(?:set|takim|ikili|2 li|kombin)\b/.test(listing);

  if (
    titleContainsRequestedItem ||
    descriptionContainsRequestedItem ||
    explicitlyBundled
  ) {
    return null;
  }

  return {
    id: 'product-package-scope',
    fact: 'PRODUCT_INFO',
    label: 'Paket kapsamı',
    value: `İlan tek ürün olarak "${input.title}" adıyla listeleniyor. Başlıkta ve ürün açıklamasında ${requestedItem} ya da set/takım içeriği belirtilmiyor.`,
    source: 'TITLE',
    confidence: 0.95,
  };
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

function isSizeGuideLocationQuestion(normalizedQuestion: string) {
  return (
    /(?:beden|b den) tablo/.test(normalizedQuestion) &&
    /nerede|nerden|nereden|nasil|bak|bul|ac|ulas/.test(normalizedQuestion)
  );
}

function isHeightWeightSizeQuestion(normalizedQuestion: string) {
  return /\b(?:boy|boyum|kilo|kiloyum|kg)\b/.test(normalizedQuestion);
}

function sizeGuideLocationForProvider(providerKey: string) {
  if (providerKey === 'trendyol') {
    return 'Trendyol ürün sayfasında beden seçenekleri bölümündeki Beden Tablosu bağlantısından açılır.';
  }

  if (providerKey === 'hepsiburada') {
    return 'Hepsiburada ürün sayfasındaki Beden Tablosu bağlantısına basıldığında sağ taraftaki panelde açılır.';
  }

  return 'Ürün sayfasındaki beden seçenekleri bölümünde yer alan Beden Tablosu bağlantısından açılır.';
}

function isProductWidthQuestion(normalizedQuestion: string) {
  return /(?:^| )(?:en|eni|genislik|genisligi)(?: |$)/.test(normalizedQuestion);
}

function containsProductWidthMeasurement(normalizedText: string) {
  const normalized = normalizeSearchValue(normalizedText);
  return /(?:^| )(?:urun eni|beden eni|en olcusu|genislik)(?: |$)/.test(
    normalized,
  );
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
    /(?:^| )(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|standart)(?: |$)/,
  )?.[1];

  if (letterSize) {
    const numberedExtraLarge = letterSize.match(/^([2-6])xl$/);
    return numberedExtraLarge
      ? `${'X'.repeat(Number(numberedExtraLarge[1]))}L`
      : letterSize.toLocaleUpperCase('tr-TR');
  }

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

function findMentions(normalizedQuestion: string, values: string[]) {
  return [...values]
    .sort((left, right) => right.length - left.length)
    .filter((value) =>
      ` ${normalizedQuestion} `.includes(` ${normalizeSearchValue(value)} `),
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
