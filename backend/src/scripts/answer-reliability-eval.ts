import 'dotenv/config';
import { GeminiClientService } from '../modules/ai/gemini-client.service';
import {
  applySellerTone,
  GeminiDraftService,
  sanitizeDraftAnswer,
} from '../modules/ai/gemini-draft.service';
import type { AiDraftResult } from '../modules/ai/ai-draft.types';
import { MockCatalogConnector } from '../modules/channels/providers/mock-catalog.connector';
import {
  MOCK_HEPSIBURADA_QUESTIONS,
  MOCK_TRENDYOL_QUESTIONS,
  MockQuestionConnector,
} from '../modules/channels/providers/mock-question.connector';
import type {
  ConnectorContext,
  NormalizedProduct,
} from '../modules/channels/providers/catalog-connector';
import { analyzeProductQuestion } from '../modules/questions/product-answer-context.service';
import type {
  ProductAnswerContext,
  ProductAnswerFact,
} from '../modules/questions/product-answer-context.types';
import { evaluateQuestionResponsePolicy } from '../modules/questions/question-response-policy.service';
import { applyHeightWeightSizeRecommendation } from '../modules/questions/height-weight-size-recommendation';
import { formatNormalizedSizeGuide } from '../modules/size-guides/size-guide-queue.service';

const PROVIDERS = ['trendyol', 'hepsiburada'] as const;
const connectorContext: ConnectorContext = {
  environment: 'SANDBOX',
  credentials: {},
};

async function run() {
  const targetedOnly =
    process.argv.includes('--targeted-only') ||
    process.argv.includes('--fit-only');
  const contexts = targetedOnly
    ? await createTargetedEvaluationContexts()
    : await createEvaluationContexts();
  const deterministic = evaluateContexts(contexts);
  const regressions = evaluateRegressions();
  const withAi = process.argv.includes('--with-ai');
  const ai = withAi ? await evaluateAiDrafts(contexts) : null;

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode: targetedOnly
          ? withAi
            ? 'TARGETED_REGRESSION_WITH_GEMINI'
            : 'TARGETED_REGRESSION_CONTEXT_ONLY'
          : withAi
            ? 'CONTEXT_AND_GEMINI'
            : 'CONTEXT_ONLY',
        ...deterministic,
        regressions,
        ai,
      },
      null,
      2,
    )}\n`,
  );
}

async function createTargetedEvaluationContexts() {
  const catalog = new MockCatalogConnector();
  const productBatches = new Map(
    await Promise.all(
      PROVIDERS.map(async (provider) => {
        const batch = await catalog.fetchProducts(provider, connectorContext);
        assertNoLegacySyntheticDescriptions(batch.products);
        return [provider, batch.products] as const;
      }),
    ),
  );
  const cases = [
    {
      provider: 'trendyol' as const,
      productCode: 'D1902AX25SM',
      questionId: 'regression-loose-fit-ai',
      question: 'bol kesim mi bunlar',
    },
    {
      provider: 'trendyol' as const,
      productCode: 'Z9933AZ23SP',
      questionId: 'regression-inflected-jogger-fit-ai',
      question: 'Kalıbı nasıl ?',
    },
    {
      provider: 'trendyol' as const,
      productCode: 'F3269AX25AU',
      questionId: 'regression-stretch-ai',
      question: 'Merhaba. Esnek bir kumaş mı?',
    },
    {
      provider: 'hepsiburada' as const,
      productCode: 'F6265AX25SM',
      questionId: 'regression-color-identity-ai',
      question: 'Merhaba ürün rengi nedir?',
    },
    {
      provider: 'hepsiburada' as const,
      productCode: 'E6885AXNS',
      questionId: 'regression-alternative-color-ai',
      question: 'Merhaba, renk gri mi yeşil mi?',
    },
    {
      provider: 'hepsiburada' as const,
      productCode: 'D9882AX25AU',
      questionId: 'regression-package-scope-ai',
      question: 'şort geliyormu',
    },
  ];

  return cases.map((testCase) => {
    const product = productBatches
      .get(testCase.provider)
      ?.find((candidate) => candidate.title.includes(testCase.productCode));
    if (!product) {
      throw new Error(
        `${testCase.productCode} hedefli AI regresyon ürünü katalogda bulunamadı.`,
      );
    }

    return analyzeProductQuestion({
      questionId: testCase.questionId,
      question: testCase.question,
      providerKey: testCase.provider,
      product: {
        id: product.externalId,
        title: product.title,
        description: product.description ?? null,
        brand: product.brand ?? null,
        category: product.category ?? null,
        attributes: product.attributes,
        variants: product.variants.map((variant) => ({
          title: variant.title ?? null,
          sku: variant.sku,
          color: variant.color ?? null,
          size: variant.size ?? null,
          price: variant.price,
          currency: variant.currency,
          stock: variant.stock,
          status: variant.stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
          lastSyncedAt: new Date().toISOString(),
        })),
        sizeGuides: [],
      },
    });
  });
}

function evaluateRegressions() {
  assertDeterministicResponsePolicy();

  const product: ProductAnswerContext['product'] = {
    id: 'regression-product',
    title: 'Sergio Regular Fit Jean Pantolon F9571AX26SP',
    description: 'Renk: Haki. Yıkama talimatı: 30 derecede yıkayınız.',
    brand: 'DeFacto',
    category: 'Jean',
    attributes: [
      { name: 'Renk', value: 'Haki' },
      { name: 'Yıkama Talimatı', value: '30 derecede yıkayınız.' },
    ],
    variants: [
      {
        title: 'Haki / 30',
        sku: 'F9571AX26SP-30',
        color: 'Haki',
        size: '30',
        price: 539.99,
        currency: 'TRY',
        stock: 14,
        status: 'ACTIVE',
        lastSyncedAt: new Date().toISOString(),
      },
    ],
    sizeGuides: [
      {
        id: 'guide-1',
        sourceUrl: 'https://cdn.dsmcdn.com/size-guide.jpg',
        normalizedText: [
          'Erkek jean beden tablosu',
          'Ölçü birimi: CM',
          'Beden 30 · Bel: 80-82 cm · Basen: 98-100 cm · Boy: 104 cm',
          'Beden 32 · Bel: 84-86 cm · Basen: 102-104 cm · Boy: 105 cm',
        ].join('\n'),
        confidence: 0.96,
        structuredData: null,
      },
    ],
  };
  const colorFade = analyzeProductQuestion({
    questionId: 'regression-color-fade',
    question: 'Haki rengin yıkamada solma ihtimali var mı?',
    product,
  });
  if (
    colorFade.requestedFacts.includes('STOCK') ||
    colorFade.requestedFacts.includes('COLOR') ||
    !colorFade.requestedFacts.includes('DURABILITY')
  ) {
    throw new Error('Renk solması sorusu yanlış niyetle sınıflandırıldı.');
  }
  const sanitized = sanitizeDraftAnswer(
    'Haki rengi stoklarımızda mevcuttur. Yıkamada solma ihtimali ürün özelliklerinde belirtilmediği için bu konuda kesin bir şey söyleyemiyoruz.',
    colorFade.requestedFacts,
  );
  if (/stok|mevcut/i.test(sanitized)) {
    throw new Error('Sorulmayan stok cümlesi taslaktan temizlenemedi.');
  }

  const sellerTone = applySellerTone(
    'Ürün regular, yani standart kesimdir.',
    'regression-seller-tone',
  );
  const sellerToneRepeated = applySellerTone(
    'Merhabalar, ürün regular, yani standart kesimdir. Keyifli alışverişler dileriz.',
    'regression-seller-tone',
  );
  if (
    !/^Merhaba(?:lar)?,/.test(sellerTone) ||
    !/(?:alışverişler|günler) dileriz\.$/.test(sellerTone) ||
    (sellerToneRepeated.match(/Merhabalar/g) ?? []).length !== 1 ||
    (sellerToneRepeated.match(/Keyifli alışverişler dileriz\./g) ?? [])
      .length !== 1
  ) {
    throw new Error('Satıcı selamlama ve kapanış üslubu uygulanamadı.');
  }

  const productCode = analyzeProductQuestion({
    questionId: 'regression-product-code',
    question: 'Ürün kodunu öğrenebilir miyim?',
    product,
  });
  if (
    !productCode.requestedFacts.includes('PRODUCT_CODE') ||
    !productCode.evidence.some(
      (evidence) =>
        evidence.id === 'title-product-code' &&
        evidence.value === 'F9571AX26SP',
    )
  ) {
    throw new Error('Ürün kodu başlıktan kanıta dönüştürülemedi.');
  }

  const sizeGuide = analyzeProductQuestion({
    questionId: 'regression-size-guide',
    question: '30 bedenin bel ölçüsü kaç cm?',
    product,
  });
  const sizeEvidence = sizeGuide.evidence.find(
    (evidence) => evidence.source === 'SIZE_GUIDE',
  );
  if (
    !sizeGuide.requestedFacts.includes('SIZE') ||
    !sizeEvidence?.value.includes('Bel: 80-82 cm') ||
    sizeEvidence.value.includes('Beden 32')
  ) {
    throw new Error('İlgili beden tablosu satırı kanıta dönüştürülemedi.');
  }

  const colorChoice = analyzeProductQuestion({
    questionId: 'regression-color-choice',
    question: 'Renk gri mi yeşil mi?',
    providerKey: 'trendyol',
    product: {
      ...product,
      attributes: [{ name: 'Renk', value: 'Yeşil' }],
      variants: product.variants.map((variant) => ({
        ...variant,
        color: 'Yeşil',
      })),
    },
  });
  if (
    colorChoice.matchedColor !== 'Yeşil' ||
    !colorChoice.evidence.some(
      (evidence) =>
        evidence.fact === 'COLOR' && evidence.value.includes('Yeşil'),
    )
  ) {
    throw new Error(
      'Seçenekli renk sorusu mevcut ürün rengiyle eşleştirilemedi.',
    );
  }

  const differentColorChoice = analyzeProductQuestion({
    questionId: 'regression-different-color-choice',
    question: 'Merhaba, renk gri mi yeşil mi?',
    providerKey: 'hepsiburada',
    product: {
      ...product,
      attributes: [{ name: 'Renk', value: 'Siyah' }],
      variants: product.variants.map((variant) => ({
        ...variant,
        color: 'Siyah',
      })),
    },
  });
  if (
    differentColorChoice.requestedColor !== null ||
    !differentColorChoice.evidence.some(
      (evidence) =>
        evidence.fact === 'COLOR' && evidence.value.includes('Siyah'),
    )
  ) {
    throw new Error(
      'Ürünün gerçek rengi sorudaki iki renkten farklıyken doğru renk kanıtı üretilemedi.',
    );
  }

  const directColorQuestion = analyzeProductQuestion({
    questionId: 'regression-direct-color-question',
    question: 'Merhaba ürün rengi nedir?',
    providerKey: 'hepsiburada',
    product: {
      ...product,
      attributes: [],
      variants: product.variants.map((variant) => ({
        ...variant,
        color: 'Yeşil-GN654',
      })),
    },
  });
  if (
    !directColorQuestion.requestedFacts.includes('COLOR') ||
    !directColorQuestion.evidence.some(
      (evidence) =>
        evidence.fact === 'COLOR' && evidence.value.includes('Yeşil-GN654'),
    )
  ) {
    throw new Error('Doğrudan ürün rengi sorusu varyant rengini bulamadı.');
  }

  const packageScope = analyzeProductQuestion({
    questionId: 'regression-package-scope',
    question: 'şort geliyormu',
    providerKey: 'trendyol',
    product: {
      ...product,
      title:
        'Relax Fit Polo Yaka Keten Karışımlı Kısa Kollu Gömlek D9882AX25AU',
      category: 'Gömlek',
      description:
        'Keten karışımlı kısa kollu gömlek, günlük kullanım için tasarlanmıştır.',
      attributes: [{ name: 'Ürün Tipi', value: 'Gömlek' }],
    },
  });
  if (
    !packageScope.evidence.some(
      (evidence) => evidence.id === 'product-package-scope',
    )
  ) {
    throw new Error('Tek ürün ilanından paket kapsamı kanıtı üretilemedi.');
  }

  const looseFitQuestion = analyzeProductQuestion({
    questionId: 'regression-loose-fit-question',
    question: 'bol kesim mi bunlar',
    providerKey: 'trendyol',
    product: {
      ...product,
      title: 'Regular Fit Yazlık Pamuklu Kısa Kollu Beyaz Gömlek D1902AX25SM',
      category: 'Gömlek',
      description:
        'Regular Fit Yazlık Pamuklu Kısa Kollu Beyaz Gömlek. Kalıp: Regular.',
      attributes: [
        { name: 'Kalıp', value: 'Regular' },
        { name: 'Siluet', value: 'Regular' },
      ],
    },
  });
  if (
    !looseFitQuestion.requestedFacts.includes('FIT') ||
    looseFitQuestion.requestedFacts.includes('PRODUCT_INFO') ||
    !looseFitQuestion.evidence.some(
      (evidence) => evidence.fact === 'FIT' && evidence.value === 'Regular',
    )
  ) {
    throw new Error(
      'Bol kesim sorusu regular kalıp kanıtıyla ilişkilendirilemedi.',
    );
  }

  const inflectedJoggerFitQuestion = analyzeProductQuestion({
    questionId: 'regression-inflected-jogger-fit-question',
    question: 'Kalıbı nasıl ?',
    providerKey: 'trendyol',
    product: {
      ...product,
      title:
        '%100 Pamuk Yazlık Jogger Chino Pantolon Beli Bağcıklı Cepli Düz Paça Z9933AZ23SP',
      category: 'Pantolon',
      description:
        'Kalıp: Jogger — Eşofmana benzer, rahat kesim. Siluet: Jogger.',
      attributes: [
        {
          name: 'Kalıp',
          value: 'Jogger — Eşofmana benzer, rahat kesim',
        },
        { name: 'Siluet', value: 'Jogger' },
      ],
    },
  });
  if (
    !inflectedJoggerFitQuestion.requestedFacts.includes('FIT') ||
    inflectedJoggerFitQuestion.requestedFacts.includes('PRODUCT_INFO') ||
    !inflectedJoggerFitQuestion.evidence.some(
      (evidence) =>
        evidence.fact === 'FIT' &&
        evidence.value.includes('Eşofmana benzer, rahat kesim'),
    )
  ) {
    throw new Error(
      'Çekimli "kalıbı" sorusu Jogger kalıp kanıtıyla ilişkilendirilemedi.',
    );
  }

  const semanticFallback = analyzeProductQuestion({
    questionId: 'regression-semantic-fallback',
    question: 'Bu model günlük kullanım için nasıl tasarlanmış?',
    product: {
      ...product,
      attributes: [
        { name: 'Kalıp', value: 'Regular' },
        { name: 'Ortam', value: 'Günlük' },
        { name: 'Renk', value: 'Beyaz' },
      ],
    },
  });
  if (
    semanticFallback.relevantAttributes.length === 0 ||
    !semanticFallback.evidence.some(
      (evidence) => evidence.source === 'ATTRIBUTE',
    )
  ) {
    throw new Error(
      'Birebir eşleşmeyen genel ürün sorusuna temel katalog bağlamı eklenemedi.',
    );
  }

  const sizeGuideLocation = analyzeProductQuestion({
    questionId: 'regression-size-guide-location',
    question: 'b den tablosuna nereden bakılıyor',
    providerKey: 'trendyol',
    product,
  });
  if (
    !sizeGuideLocation.requestedFacts.includes('SIZE') ||
    !sizeGuideLocation.evidence.some(
      (evidence) => evidence.source === 'PLATFORM_GUIDANCE',
    )
  ) {
    throw new Error(
      'Beden tablosu konum sorusu platform yönlendirmesi üretmedi.',
    );
  }

  const garmentWidth = analyzeProductQuestion({
    questionId: 'regression-garment-width',
    question: 'XL bedenin eni kaç cm?',
    providerKey: 'hepsiburada',
    product,
  });
  if (
    garmentWidth.evidence.some((evidence) => evidence.source === 'SIZE_GUIDE')
  ) {
    throw new Error('Vücut çevresi tablosu ürün eni kanıtı olarak kullanıldı.');
  }

  const ribbedFabric = analyzeProductQuestion({
    questionId: 'regression-ribbed-fabric',
    question: 'Kumaşı riklalı mı?',
    product: {
      ...product,
      description: 'Dokuma Tipi: Düz Dokuma. Materyal Bileşeni: %100 Pamuk.',
      attributes: [
        { name: 'Dokuma Tipi', value: 'Düz Dokuma' },
        { name: 'Materyal Bileşeni', value: '%100 Pamuk' },
      ],
    },
  });
  if (
    !ribbedFabric.requestedFacts.includes('MATERIAL') ||
    !ribbedFabric.evidence.some((evidence) => evidence.value === 'Düz Dokuma')
  ) {
    throw new Error('Ribana sorusu düz dokuma kanıtıyla eşleştirilemedi.');
  }

  const heightWeightProduct: ProductAnswerContext['product'] = {
    ...product,
    variants: [
      {
        ...product.variants[0],
        title: 'Haki / XXL',
        sku: 'F9571AX26SP-XXL',
        size: 'XXL',
      },
    ],
    sizeGuides: [
      {
        id: 'height-weight-guide',
        sourceUrl: 'https://cdn.dsmcdn.com/height-weight-size-guide.jpg',
        normalizedText: 'Beden 2XL · Boy (cm): 190-200 · Kilo (kg): 96-110',
        confidence: 1,
        structuredData: {
          unit: 'CM',
          headers: ['Boy (cm)', 'Kilo (kg)'],
          rows: [
            {
              label: '2XL',
              measurements: [
                { name: 'Boy (cm)', value: '190-200' },
                { name: 'Kilo (kg)', value: '96-110' },
              ],
            },
          ],
          notes: [],
          confidence: 1,
        },
      },
    ],
  };
  const sizeRecommendationPreferences = {
    automationMode: 'SAFE_AUTO',
    minimumAutoSendConfidence: 0.85,
    tone: 'PROFESSIONAL',
    responseLength: 'BALANCED',
    greetingEnabled: true,
    closingEnabled: true,
    emojiPolicy: 'NEVER',
    preferredEmoji: null,
    heightWeightSizeRecommendationEnabled: true,
    instructions: [],
    approvedAnswerExamples: [],
  } satisfies NonNullable<ProductAnswerContext['responsePreferences']>;
  const heightWeightRecommendation = applyHeightWeightSizeRecommendation({
    ...analyzeProductQuestion({
      questionId: 'regression-height-weight-size',
      question: '193 102 kg 2xl olur mu?',
      product: heightWeightProduct,
    }),
    responsePreferences: sizeRecommendationPreferences,
  });
  if (
    heightWeightRecommendation.heightWeightSizeRecommendation?.status !==
      'MATCHED' ||
    heightWeightRecommendation.heightWeightSizeRecommendation
      .recommendedSizes[0] !== '2XL' ||
    !heightWeightRecommendation.evidence.some(
      (evidence) => evidence.id === 'height-weight-size-height-weight-guide',
    )
  ) {
    throw new Error('Boy-kilo bilgisi beden tablosuyla eşleştirilemedi.');
  }

  const disabledHeightWeightRecommendation =
    applyHeightWeightSizeRecommendation({
      ...analyzeProductQuestion({
        questionId: 'regression-disabled-height-weight-size',
        question: '193 102 kg hangi beden olur?',
        product: heightWeightProduct,
      }),
      responsePreferences: {
        ...sizeRecommendationPreferences,
        heightWeightSizeRecommendationEnabled: false,
      },
    });
  if (
    disabledHeightWeightRecommendation.heightWeightSizeRecommendation
      ?.status !== 'DISABLED'
  ) {
    throw new Error('Kapalı beden önerisi ayarı uygulanamadı.');
  }

  return {
    abusiveContentDeterministicallyIgnored: true,
    complaintsAndNonAbusiveQuestionsAllowed: true,
    unsolicitedStockRemoved: true,
    sellerToneAppliedWithoutDuplication: true,
    productCodeEvidenceCreated: true,
    relevantSizeGuideRowSelected: true,
    colorChoiceMatched: true,
    differentColorChoiceResolved: true,
    directColorQuestionResolved: true,
    singleProductPackageScopeCreated: true,
    looseFitMappedToRegularEvidence: true,
    inflectedFitMappedToJoggerEvidence: true,
    semanticCatalogFallbackCreated: true,
    sizeGuideLocationGuidanceCreated: true,
    garmentWidthSeparatedFromBodyMeasurements: true,
    ribbedFabricEvidenceCreated: true,
    heightWeightSizeRecommendationMatched: true,
    disabledHeightWeightSizeRecommendationBlocked: true,
  };
}

function assertDeterministicResponsePolicy() {
  const abusiveQuestions = [
    'Defacto orospu çocuğudur',
    'Ananı sikeyim',
    'Siktir git',
    'Şerefsiz',
    'Siz gerçekten gerizekalısınız',
  ];
  const allowedQuestions = [
    'Recep Tayyip Erdoğan kimdir?',
    "Koton'daki ürün mü daha kaliteli, bu ürün mü?",
    'Ürün çok kötü, iade etmek istiyorum.',
    'Satıcıdan şikayetçiyim.',
    'Bu beden tablosu çok saçma.',
    'Eksik ürün geldi.',
    'Klasik kesim mi?',
  ];

  const missedAbuse = abusiveQuestions.filter(
    (question) =>
      evaluateQuestionResponsePolicy(question).action !== 'DO_NOT_REPLY',
  );
  const falsePositives = allowedQuestions.filter(
    (question) => evaluateQuestionResponsePolicy(question).action !== 'ALLOW',
  );

  if (missedAbuse.length > 0 || falsePositives.length > 0) {
    throw new Error(
      `Yanıt politikası regresyonu başarısız: ${JSON.stringify({
        missedAbuse,
        falsePositives,
      })}`,
    );
  }
}

async function createEvaluationContexts() {
  const catalog = new MockCatalogConnector();
  const questions = new MockQuestionConnector();
  const contexts: ProductAnswerContext[] = [];

  for (const provider of PROVIDERS) {
    const [productBatch, questionBatch] = await Promise.all([
      catalog.fetchProducts(provider, connectorContext),
      questions.fetchProductQuestions(provider, connectorContext, {
        createdAfter: new Date(Date.now() - 60_000),
      }),
    ]);
    const productsByExternalId = new Map(
      productBatch.products.map((product) => [product.externalId, product]),
    );
    assertNoLegacySyntheticDescriptions(productBatch.products);

    for (const question of questionBatch.questions.filter(
      (candidate) => candidate.rawPayload.historical !== true,
    )) {
      const product = productsByExternalId.get(question.externalProductId);
      if (!product) {
        throw new Error(
          `${provider}: ${question.externalId} sorusu ürünle eşleşmedi.`,
        );
      }

      contexts.push(
        analyzeProductQuestion({
          questionId: question.externalId,
          question: question.text,
          providerKey: provider,
          product: {
            id: product.externalId,
            title: product.title,
            description: product.description ?? null,
            brand: product.brand ?? null,
            category: product.category ?? null,
            attributes: product.attributes,
            variants: product.variants.map((variant) => ({
              title: variant.title ?? null,
              sku: variant.sku,
              color: variant.color ?? null,
              size: variant.size ?? null,
              price: variant.price,
              currency: variant.currency,
              stock: variant.stock,
              status: variant.stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
              lastSyncedAt: new Date().toISOString(),
            })),
            sizeGuides: product.sizeGuide?.structuredData
              ? [
                  {
                    id: `${product.externalId}-size-guide`,
                    sourceUrl: product.sizeGuide.sourceUrl,
                    normalizedText: formatNormalizedSizeGuide(
                      product.sizeGuide.structuredData,
                    ),
                    confidence:
                      product.sizeGuide.structuredData.confidence ?? null,
                    structuredData: product.sizeGuide.structuredData,
                  },
                ]
              : [],
          },
        }),
      );
    }
  }

  const expectedContexts = MOCK_TRENDYOL_QUESTIONS + MOCK_HEPSIBURADA_QUESTIONS;
  if (contexts.length !== expectedContexts) {
    throw new Error(
      `${expectedContexts} yerine ${contexts.length} değerlendirme bağlamı oluştu.`,
    );
  }
  return contexts;
}

function assertNoLegacySyntheticDescriptions(products: NormalizedProduct[]) {
  for (const product of products) {
    const lines = (product.description ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines[0] !== product.title || lines.length < 4) continue;

    const attributeRows = new Set(
      product.attributes.map((attribute) =>
        `${attribute.name}: ${attribute.value}`.trim(),
      ),
    );
    const matchingRows = lines
      .slice(1)
      .filter((line) => attributeRows.has(line)).length;
    if (matchingRows >= Math.min(3, product.attributes.length)) {
      throw new Error(
        `${product.externalId}: eski sentetik ürün açıklaması dışarı açıldı.`,
      );
    }
  }
}

function evaluateContexts(contexts: ProductAnswerContext[]) {
  const intentCounts = new Map<ProductAnswerFact, number>();
  let totalFullPayloadBytes = 0;
  let totalEvidencePayloadBytes = 0;
  let contextsWithoutEvidence = 0;

  for (const context of contexts) {
    if (context.requestedFacts.length === 0) {
      throw new Error(`${context.questionId}: niyet tespit edilemedi.`);
    }
    if (
      new Set(context.evidence.map((item) => item.id)).size !==
      context.evidence.length
    ) {
      throw new Error(
        `${context.questionId}: yinelenen kanıt kimliği bulundu.`,
      );
    }
    if (context.evidence.length === 0) contextsWithoutEvidence += 1;

    for (const fact of context.requestedFacts) {
      intentCounts.set(fact, (intentCounts.get(fact) ?? 0) + 1);
    }
    totalFullPayloadBytes += Buffer.byteLength(
      JSON.stringify(context.product),
      'utf8',
    );
    totalEvidencePayloadBytes += Buffer.byteLength(
      JSON.stringify({
        question: context.question,
        intents: context.requestedFacts,
        evidence: context.evidence,
      }),
      'utf8',
    );
  }

  const payloadReduction =
    1 - totalEvidencePayloadBytes / Math.max(1, totalFullPayloadBytes);
  if (payloadReduction < 0.25) {
    throw new Error(
      `Kanıt bağlamı yeterince küçülmedi: %${Math.round(payloadReduction * 100)}.`,
    );
  }

  const stretchContext = contexts.find(
    (context) =>
      context.questionId === 'real-defacto-question-v1-f3269-stretch' ||
      context.questionId === 'regression-stretch-ai',
  );
  if (stretchContext) {
    const materialEvidence = stretchContext.evidence.filter(
      (evidence) => evidence.fact === 'MATERIAL',
    );
    const exactCompositionFound = materialEvidence.some((evidence) => {
      const value = normalizeEvaluationText(evidence.value);
      return (
        /(?:elastan 2|2 elastan)/.test(value) &&
        /(?:pamuk 88|88 pamuk)/.test(value) &&
        /(?:poliester 10|polyester 10|10 poliester|10 polyester)/.test(value)
      );
    });
    const staleCompositionFound = stretchContext.evidence.some((evidence) => {
      const value = normalizeEvaluationText(evidence.value);
      return /70 polyester/.test(value) && /30 pamuk/.test(value);
    });
    const sourceDescription = normalizeEvaluationText(
      stretchContext.product.description ?? '',
    );
    const exactDescriptionFound =
      sourceDescription.includes(
        'jogger fit kesimi ve pamuklu kumasiyla rahatlik sunan pantolon',
      ) &&
      sourceDescription.includes('manken bedeni haki kh475 32') &&
      sourceDescription.includes('urun kodu f3269ax25au');

    if (
      !stretchContext.requestedFacts.includes('MATERIAL') ||
      !exactCompositionFound ||
      staleCompositionFound ||
      !exactDescriptionFound
    ) {
      throw new Error(
        'F3269 esneklik sorusu gerçek açıklama ve %2 Elastan bileşimiyle kanıtlanamadı.',
      );
    }
  }

  return {
    questions: contexts.length,
    matchedProducts: contexts.length,
    contextsWithEvidence: contexts.length - contextsWithoutEvidence,
    contextsWithoutEvidence,
    payloadReductionPercent: Math.round(payloadReduction * 100),
    intentCounts: Object.fromEntries(intentCounts),
    exactStretchCompositionVerified: Boolean(stretchContext),
  };
}

async function evaluateAiDrafts(contexts: ProductAnswerContext[]) {
  const generator = new GeminiDraftService(new GeminiClientService());
  let drafted = 0;
  let needsReview = 0;
  let unsupported = 0;
  let looseFitRegressionAnswer: string | null = null;
  let joggerFitRegressionAnswer: string | null = null;
  let stretchRegressionAnswer: string | null = null;
  let colorIdentityRegressionAnswer: string | null = null;
  let alternativeColorRegressionAnswer: string | null = null;
  let packageScopeRegressionAnswer: string | null = null;

  for (const [index, context] of contexts.entries()) {
    const result = await generator.generate(context);
    if (!result) {
      throw new Error(`${context.questionId}: Gemini taslak üretemedi.`);
    }
    drafted += 1;
    if (result.decision === 'NEEDS_REVIEW') needsReview += 1;
    if (result.risks.includes('UNSUPPORTED_CLAIM')) unsupported += 1;
    if (context.questionId === 'regression-loose-fit-ai') {
      assertLooseFitAiResult(result);
      looseFitRegressionAnswer = result.answer;
    }
    if (context.questionId === 'regression-inflected-jogger-fit-ai') {
      assertJoggerFitAiResult(result);
      joggerFitRegressionAnswer = result.answer;
    }
    if (context.questionId === 'regression-stretch-ai') {
      assertStretchAiResult(result);
      stretchRegressionAnswer = result.answer;
    }
    if (context.questionId === 'regression-color-identity-ai') {
      assertColorIdentityAiResult(result, 'yesil');
      colorIdentityRegressionAnswer = result.answer;
    }
    if (context.questionId === 'regression-alternative-color-ai') {
      assertColorIdentityAiResult(result, 'siyah');
      alternativeColorRegressionAnswer = result.answer;
    }
    if (context.questionId === 'regression-package-scope-ai') {
      assertPackageScopeAiResult(result);
      packageScopeRegressionAnswer = result.answer;
    }
    process.stderr.write(`AI değerlendirme ${index + 1}/${contexts.length}\n`);
  }

  return {
    drafted,
    needsReview,
    unsupported,
    looseFitRegressionAnswer,
    joggerFitRegressionAnswer,
    stretchRegressionAnswer,
    colorIdentityRegressionAnswer,
    alternativeColorRegressionAnswer,
    packageScopeRegressionAnswer,
  };
}

function assertLooseFitAiResult(result: AiDraftResult) {
  assertSemanticMetadata(result, 'FIT');
  const answer = normalizeEvaluationText(result.answer);
  const identifiesRegularFit = /\b(?:regular|standart|normal)\b/.test(answer);
  const hasSellerOpening = /^(?:merhaba|merhabalar)\b/.test(answer);
  const hasSellerClosing =
    /(?:keyifli alisverisler|iyi alisverisler|iyi gunler)(?: dileriz)?$/.test(
      answer,
    );
  const rejectsLooseFit =
    /\bbol\b.{0,30}\bdegil/.test(answer) ||
    /\bdegil\w*.{0,30}\bbol\b/.test(answer) ||
    /\boversize\b.{0,30}\bdegil/.test(answer);

  if (
    result.decision !== 'DRAFT' ||
    result.missingInformation.length > 0 ||
    !result.usedFacts.includes('FIT') ||
    !hasSellerOpening ||
    !hasSellerClosing ||
    !identifiesRegularFit ||
    !rejectsLooseFit
  ) {
    throw new Error(
      `Regular/bol kesim AI regresyonu başarısız: ${JSON.stringify({
        answer: result.answer,
        decision: result.decision,
        missingInformation: result.missingInformation,
        usedFacts: result.usedFacts,
      })}`,
    );
  }
}

function assertJoggerFitAiResult(result: AiDraftResult) {
  assertSemanticMetadata(result, 'FIT');
  const answer = normalizeEvaluationText(result.answer);
  const identifiesJoggerFit = /\bjogger\b/.test(answer);
  const explainsFit = /\b(?:rahat|esofman)\b/.test(answer);
  const hasSellerOpening = /^(?:merhaba|merhabalar)\b/.test(answer);
  const hasSellerClosing =
    /(?:keyifli alisverisler|iyi alisverisler|iyi gunler)(?: dileriz)?$/.test(
      answer,
    );

  if (
    result.decision !== 'DRAFT' ||
    result.missingInformation.length > 0 ||
    !result.usedFacts.includes('FIT') ||
    !hasSellerOpening ||
    !hasSellerClosing ||
    !identifiesJoggerFit ||
    !explainsFit
  ) {
    throw new Error(
      `Jogger kalıp AI regresyonu başarısız: ${JSON.stringify({
        answer: result.answer,
        decision: result.decision,
        missingInformation: result.missingInformation,
        usedFacts: result.usedFacts,
      })}`,
    );
  }
}

function assertStretchAiResult(result: AiDraftResult) {
  assertSemanticMetadata(result, 'MATERIAL');
  const answer = normalizeEvaluationText(result.answer);
  const hasExactElastane = /(?:2 elastan|elastan 2)/.test(answer);
  const explainsStretch = /esnek|esneklik/.test(answer);
  const hasSellerOpening = /^(?:merhaba|merhabalar)\b/.test(answer);
  const hasSellerClosing =
    /(?:keyifli alisverisler|iyi alisverisler|iyi gunler)(?: dileriz)?$/.test(
      answer,
    );
  const repeatsStaleComposition =
    /70 polyester/.test(answer) || /30 pamuk/.test(answer);

  if (
    result.decision !== 'DRAFT' ||
    result.missingInformation.length > 0 ||
    !result.usedFacts.includes('MATERIAL') ||
    !hasSellerOpening ||
    !hasSellerClosing ||
    !hasExactElastane ||
    !explainsStretch ||
    repeatsStaleComposition
  ) {
    throw new Error(
      `Esneklik AI regresyonu başarısız: ${JSON.stringify({
        answer: result.answer,
        decision: result.decision,
        missingInformation: result.missingInformation,
        usedFacts: result.usedFacts,
      })}`,
    );
  }
}

function assertColorIdentityAiResult(
  result: AiDraftResult,
  expectedColor: string,
) {
  assertSemanticMetadata(result, 'COLOR');
  const answer = normalizeEvaluationText(result.answer);
  if (!answer.includes(expectedColor)) {
    throw new Error(
      `Renk AI regresyonu beklenen ${expectedColor} rengini söylemedi: ${JSON.stringify(
        {
          answer: result.answer,
          detectedFacts: result.detectedFacts,
          usedEvidenceIds: result.usedEvidenceIds,
        },
      )}`,
    );
  }
}

function assertPackageScopeAiResult(result: AiDraftResult) {
  assertSemanticMetadata(result, 'PRODUCT_INFO');
  const answer = normalizeEvaluationText(result.answer);
  const rejectsShorts =
    /sort.{0,35}(?:dahil degil|bulunmuyor|gelmiyor|gonderilmez)/.test(answer) ||
    /yalnizca.{0,35}gomlek/.test(answer);
  if (!rejectsShorts) {
    throw new Error(
      `Paket kapsamı AI regresyonu şortun dahil olmadığını söylemedi: ${JSON.stringify(
        {
          answer: result.answer,
          detectedFacts: result.detectedFacts,
          usedEvidenceIds: result.usedEvidenceIds,
        },
      )}`,
    );
  }
}

function assertSemanticMetadata(
  result: AiDraftResult,
  expectedFact: ProductAnswerFact,
) {
  if (
    !result.detectedFacts.includes(expectedFact) ||
    result.interpretation.trim().length < 2 ||
    result.answerability !== 'FULL' ||
    result.missingInformation.length > 0
  ) {
    throw new Error(
      `Semantik AI çıktısı beklenen yapıda değil: ${JSON.stringify({
        expectedFact,
        interpretation: result.interpretation,
        detectedFacts: result.detectedFacts,
        answerability: result.answerability,
        missingInformation: result.missingInformation,
      })}`,
    );
  }
}

function normalizeEvaluationText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
