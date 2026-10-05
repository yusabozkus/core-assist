import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applySellerTone,
  GeminiDraftService,
} from '../ai/gemini-draft.service';
import type { GeminiClientService } from '../ai/gemini-client.service';
import { evaluateAutoSendEligibility } from './ai-auto-send-policy';
import {
  garmentLengthEvidence,
  hasUnsupportedGarmentLengthClaim,
  missingGarmentLengthInformation,
  resolveGarmentLengthGuidance,
} from './garment-length-guidance';
import { applyHeightWeightSizeRecommendation } from './height-weight-size-recommendation';
import { analyzeProductQuestion } from './product-answer-context.service';
import type { ProductAnswerContext } from './product-answer-context.types';

function product(): ProductAnswerContext['product'] {
  return {
    id: 'shirt',
    title: 'Erkek Pamuk Oversize Tişört',
    brand: null,
    category: 'T-Shirt',
    description:
      'Manken boyu: 188 cm; Göğüs çevresi: 98 cm; Ürün Uzunluk Ölçüleri: XL-78 cm,L-76 cm,S-72,5 cm,M-74 cm,XS-71 cm,XXL-79 cm',
    attributes: [{ name: 'Kesim Kalıbı', value: 'Oversize' }],
    variants: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((size) => ({
      title: null,
      sku: `shirt-${size}`,
      size,
      color: 'Siyah',
      price: 500,
      currency: 'TRY',
      stock: 0,
      status: 'OUT_OF_STOCK',
      lastSyncedAt: null,
    })),
    sizeGuides: [],
  };
}

function context(question: string, selectedProduct = product()) {
  return analyzeProductQuestion({
    questionId: 'length-question',
    question,
    providerKey: 'trendyol',
    product: selectedProduct,
  });
}

async function draft(
  answerContext: ProductAnswerContext,
  answer: string,
  overrides: Record<string, unknown> = {},
) {
  const service = new GeminiDraftService({
    isEnabled: () => true,
    generate: () =>
      Promise.resolve(
        JSON.stringify({
          answer,
          interpretation: 'Müşterinin ürün ve beden sorusu',
          scope: 'IN_SCOPE',
          detectedFacts: answerContext.requestedFacts,
          answerability: 'FULL',
          decision: 'DRAFT',
          confidence: 0.95,
          usedEvidenceIds: ['variant-sizes'],
          missingInformation: [],
          ...overrides,
        }),
      ),
  } as unknown as GeminiClientService);
  const result = await service.generate(answerContext);
  assert.ok(result);
  return result;
}

void test('catalog lengths are extracted from their own section, never model or body measurements', () => {
  const evidence = garmentLengthEvidence(product());
  assert.ok(evidence);
  assert.match(evidence.value, /S: 72,5 cm/);
  assert.match(evidence.value, /XXL: 79 cm/);
  assert.doesNotMatch(evidence.value, /188|98|3XL/);
  const withoutLengths = product();
  withoutLengths.description = 'Manken boyu: 188 cm; Göğüs çevresi: 98 cm';
  assert.equal(garmentLengthEvidence(withoutLengths), null);
});

void test('relative length questions share verified fit and dimensions without inventing a comparison', () => {
  for (const question of [
    'Bedeni normal tişörtlere göre yani oversize olmayanlara göre boyu kısa mı',
    'Normal kesime göre ürünün boyu daha uzun mu',
  ]) {
    const advice = resolveGarmentLengthGuidance(context(question));
    assert.ok(advice, question);
    assert.match(advice.answer, /72,5 cm/);
    assert.match(advice.answer, /tek başına.*göstermez/);
    assert.doesNotMatch(advice.answer, /daha uzun bir duruş|omuzdan/);
    assert.ok(advice.usedEvidenceIds.includes('catalog-garment-lengths'));
    assert.equal(advice.responseKind, 'SIZE_GUIDANCE');
  }
});

void test('a combined fit and length question answers both verified facts', () => {
  const advice = resolveGarmentLengthGuidance(
    context('Kalıbı nasıl ve M beden ürün boyu kaç cm'),
  );
  assert.ok(advice);
  assert.match(advice.answer, /oversize, yani bol kesimlidir/);
  assert.match(advice.answer, /M beden 74 cm/);
  assert.ok(advice.usedEvidenceIds.includes('catalog-fit'));
});

void test('requested size uses exact lengths and equivalent XXL/2XL labels', () => {
  const advice = resolveGarmentLengthGuidance(context('2XL beden boyu kaç cm'));
  assert.ok(advice);
  assert.match(advice.answer, /XXL beden 79 cm/);
  assert.doesNotMatch(advice.answer, /78 cm|188 cm/);
  assert.equal(
    resolveGarmentLengthGuidance(context('3XL beden boyu kaç cm')),
    null,
  );
});

void test('conflicting lengths include aliases and never produce a ready answer', () => {
  const selectedProduct = product();
  selectedProduct.description += ',2XL-81 cm';
  assert.equal(
    resolveGarmentLengthGuidance(context('Ürün boyu kaç cm', selectedProduct)),
    null,
  );
  assert.equal(
    resolveGarmentLengthGuidance(
      context('2XL beden boyu kaç cm', selectedProduct),
    ),
    null,
  );
});

void test('generic length does not imply a length for an unlisted size', () => {
  const selectedProduct = product();
  selectedProduct.description = null;
  selectedProduct.attributes.push({ name: 'Ürün Boyu', value: '74 cm' });
  assert.equal(
    resolveGarmentLengthGuidance(
      context('44 beden ürün boyu kaç cm', selectedProduct),
    ),
    null,
  );
});

void test('product length guidance cannot clear a second product feature or commercial intent', () => {
  for (const question of [
    'Ürün boyu kaç cm, cepleri var mı',
    'Ürün boyu kaç cm, kemer dahil mi',
    'Ürün boyu kaç cm ve stokta var mı',
    'Ürün boyu kaç cm ve kumaşı nedir',
    'Ürün boyu kaç cm, paça boyu ne kadar',
  ]) {
    assert.equal(
      resolveGarmentLengthGuidance(context(question)),
      null,
      question,
    );
  }
});

void test('relative guidance is not specific to shirts or an unverified measurement method', () => {
  const selectedProduct = product();
  selectedProduct.title = 'Erkek Regular Fit Pantolon';
  selectedProduct.category = 'Pantolon';
  selectedProduct.attributes = [{ name: 'Kalıp', value: 'Regular' }];
  selectedProduct.description = 'Ürün Boyu: 105 cm';
  const advice = resolveGarmentLengthGuidance(
    context('Regular pantolonun boyu normalden kısa mı', selectedProduct),
  );
  assert.ok(advice);
  assert.match(advice.answer, /105 cm/);
  assert.doesNotMatch(advice.answer, /tişört|oversize|omuz/);
});

void test('body-size tables cannot supply garment length and missing lengths stay reviewable', () => {
  const selectedProduct = product();
  selectedProduct.description = null;
  selectedProduct.sizeGuides = [
    {
      id: 'body-guide',
      sourceUrl: 'https://example.test/body.png',
      normalizedText: 'Erkek beden tablosu M Boy 180 cm',
      confidence: 1,
      structuredData: {
        title: 'Erkek beden tablosu',
        unit: 'CM',
        measurementBasis: 'BODY',
        headers: ['Beden', 'Boy'],
        rows: [{ label: 'M', measurements: [{ name: 'Boy', value: '180' }] }],
        notes: [],
        confidence: 1,
      },
    },
  ];
  const answerContext = context(
    'M beden boyu normal tişörtten kısa mı',
    selectedProduct,
  );
  assert.equal(resolveGarmentLengthGuidance(answerContext), null);
  assert.ok(missingGarmentLengthInformation(answerContext));
});

void test('garment tables keep extraction confidence and reject incompatible audiences or units', () => {
  const selectedProduct = product();
  selectedProduct.description = null;
  selectedProduct.sizeGuides = [
    {
      id: 'garment-guide',
      sourceUrl: 'https://example.test/garment.png',
      normalizedText: 'Erkek Ürün Boyu M 74 cm',
      confidence: 0.99,
      structuredData: {
        title: 'Erkek Tişört Ölçüleri',
        audience: 'MEN',
        unit: 'CM',
        measurementBasis: 'GARMENT',
        headers: ['Beden', 'Ürün Boyu'],
        rows: [
          { label: 'M', measurements: [{ name: 'Ürün Boyu', value: '74' }] },
        ],
        notes: [],
        confidence: 0.95,
      },
    },
  ];
  const advice = resolveGarmentLengthGuidance(
    context('M beden ürün boyu kaç cm', selectedProduct),
  );
  assert.ok(advice);
  assert.equal(advice.confidence, 0.95);
  selectedProduct.sizeGuides[0].structuredData!.unit = 'INCH';
  assert.equal(
    resolveGarmentLengthGuidance(
      context('M beden ürün boyu kaç cm', selectedProduct),
    ),
    null,
  );
  selectedProduct.sizeGuides[0].structuredData!.unit = 'CM';
  selectedProduct.sizeGuides[0].structuredData!.audience = 'WOMEN';
  assert.equal(
    resolveGarmentLengthGuidance(
      context('M beden ürün boyu kaç cm', selectedProduct),
    ),
    null,
  );
});

void test('unsupported fit-to-length comparisons are caught even beside a comparison invitation', () => {
  const answerContext = context('Boyu normal tişörtlere göre kısa mı');
  assert.equal(
    hasUnsupportedGarmentLengthClaim(
      'Oversize olduğu için normal kesime göre daha uzun bir duruşa sahiptir; kendi ürününüzle karşılaştırabilirsiniz.',
      answerContext,
    ),
    true,
  );
  assert.equal(
    hasUnsupportedGarmentLengthClaim(
      'Kalıp adı tek başına normal kesimden daha uzun olduğunu göstermez.',
      answerContext,
    ),
    false,
  );
});

void test('an invented list of product lengths is rejected despite an invitation in the same sentence', () => {
  const selectedProduct = product();
  selectedProduct.description = null;
  const answerContext = context(
    'Ürün boyu normal tişörtlerden kısa mı',
    selectedProduct,
  );
  assert.equal(
    hasUnsupportedGarmentLengthClaim(
      'Ürün boy uzunlukları beden seçeneklerinde yer alıyor, ölçülerinizle karşılaştırabilirsiniz.',
      answerContext,
    ),
    true,
  );
});

void test('a numeric length claim must match the requested size', () => {
  const answerContext = context('M beden boyu kaç cm');
  assert.equal(
    hasUnsupportedGarmentLengthClaim('M beden boyu 78 cm.', answerContext),
    true,
  );
  assert.equal(
    hasUnsupportedGarmentLengthClaim('M beden boyu 74 cm.', answerContext),
    false,
  );
});

void test('previous cloth trousers do not create a material intent, while a real second material question remains', () => {
  const reference =
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli';
  assert.deepEqual(context(reference).requestedFacts, ['SIZE']);
  assert.ok(
    context(`${reference}, bunun kumaşı pamuk mu`).requestedFacts.includes(
      'MATERIAL',
    ),
  );
  assert.ok(
    context('Bu kumaş pantolonun materyali nedir').requestedFacts.includes(
      'MATERIAL',
    ),
  );
});

void test('a following named measurement section is never collected as product length', () => {
  const selectedProduct = product();
  selectedProduct.description =
    'Ürün Boy Ölçüleri: M-74 cm, Kol Boyu: L-60 cm, Göğüs: XL-110 cm';
  const evidence = garmentLengthEvidence(selectedProduct);
  assert.ok(evidence);
  assert.match(evidence.value, /M: 74 cm/);
  assert.doesNotMatch(evidence.value, /60|110/);
});

void test('contradictory generic and size-specific dimensions cannot become complete guidance', async () => {
  const selectedProduct = product();
  selectedProduct.attributes.push({ name: 'Ürün Boyu', value: '80 cm' });
  const answerContext = context('M beden boyu kaç cm', selectedProduct);
  assert.equal(resolveGarmentLengthGuidance(answerContext), null);
  const result = await draft(
    answerContext,
    'M beden boyu 74 cm olarak belirtiliyor.',
  );
  assert.equal(result.decision, 'NEEDS_REVIEW');
  assert.ok(
    result.missingInformation.some((item) => /çelişen boy ölçüleri/.test(item)),
  );
});

void test('model-detected unrelated details cannot be cleared by length guidance', async () => {
  const answerContext = context('Ürün boyu kaç cm ve çıtçıtlı mı');
  const result = await draft(
    answerContext,
    'Ürün boyu M beden 74 cm; çıtçıt bilgisi bulunmuyor.',
    {
      detectedFacts: ['SIZE', 'PRODUCT_INFO'],
      answerability: 'PARTIAL',
      decision: 'NEEDS_REVIEW',
      missingInformation: ['Ürünün çıtçıt bilgisi'],
    },
  );
  assert.notEqual(result.responseKind, 'SIZE_GUIDANCE');
  assert.equal(result.decision, 'NEEDS_REVIEW');
  assert.ok(result.missingInformation.includes('Ürünün çıtçıt bilgisi'));
});

void test('actual model-like overclaim is replaced by verified length guidance and can qualify for safe auto-send', async () => {
  const answerContext = context(
    'Bedeni normal tişörtlere göre yani oversize olmayanlara göre boyu kısa mı',
  );
  const result = await draft(
    answerContext,
    'Ürün oversize olduğundan normal kesim tişörtlerden daha uzun durur. Boy uzunlukları beden seçeneklerinde yer almaktadır.',
  );
  assert.equal(result.responseKind, 'SIZE_GUIDANCE');
  assert.equal(result.decision, 'DRAFT');
  assert.match(result.answer, /M beden 74 cm/);
  assert.match(result.answer, /tek başına.*göstermez/);
  assert.equal(
    evaluateAutoSendEligibility({
      draft: result,
      decision: 'READY_FOR_SEND',
      requestedFacts: answerContext.requestedFacts,
      storeMinimumConfidence: 0.85,
    }).eligible,
    true,
  );
});

void test('without source lengths the same model overclaim requires review', async () => {
  const selectedProduct = product();
  selectedProduct.description = null;
  const answerContext = context(
    'Ürün boyu normal tişörtlere göre kısa mı',
    selectedProduct,
  );
  const result = await draft(
    answerContext,
    'Oversize olduğundan normal kesime göre daha uzun bir duruşa sahiptir.',
  );
  assert.equal(result.decision, 'NEEDS_REVIEW');
  assert.ok(result.risks.includes('UNSUPPORTED_CLAIM'));
  assert.ok(result.missingInformation.some((item) => /boy ölçüsü/.test(item)));
});

void test('height-weight disabled mixed fit selection asks for customer circumference and qualifies safely', async () => {
  const answerContext = applyHeightWeightSizeRecommendation(
    context('178 boy 70 kilo bu kalıpta hangi beden almalıyım'),
  );
  assert.equal(
    answerContext.heightWeightSizeRecommendation?.status,
    'DISABLED',
  );
  const result = await draft(
    answerContext,
    'Boy ve kiloya göre beden eşleşmesi yapılamadı.',
  );
  assert.equal(result.responseKind, 'CUSTOMER_CLARIFICATION');
  assert.equal(result.decision, 'DRAFT');
  assert.match(
    result.answer,
    /göğüs ve bel çevre ölçülerinizi paylaşabilir misiniz/,
  );
  assert.doesNotMatch(result.answer, /M beden.*uygun|tahmini/);
  assert.deepEqual(result.missingInformation, []);
  assert.equal(
    evaluateAutoSendEligibility({
      draft: result,
      decision: 'READY_FOR_SEND',
      requestedFacts: answerContext.requestedFacts,
      storeMinimumConfidence: 0.85,
    }).eligible,
    true,
  );
});

void test('missing GSM stays reviewable and is not mislabeled as a personal-size question', async () => {
  const result = await draft(
    context('S beden kaç gsm'),
    'Bu ürünün gramajı kayıtlarda belirtilmiyor.',
  );
  assert.equal(result.decision, 'NEEDS_REVIEW');
  assert.ok(result.missingInformation.some((item) => /gramaj/i.test(item)));
  assert.ok(
    !result.missingInformation.some((item) => /Kişiye uygun beden/.test(item)),
  );
});

void test('disabling the greeting removes its entire word instead of leaving a broken suffix', () => {
  const preferences: NonNullable<ProductAnswerContext['responsePreferences']> =
    {
      automationMode: 'SAFE_AUTO',
      minimumAutoSendConfidence: 0.85,
      tone: 'PROFESSIONAL',
      responseLength: 'BALANCED',
      greetingEnabled: false,
      closingEnabled: false,
      emojiPolicy: 'NEVER',
      preferredEmoji: null,
      heightWeightSizeRecommendationEnabled: false,
      instructions: [],
      approvedAnswerExamples: [],
    };
  for (const greeting of ['Merhabalar,', 'Merhaba,']) {
    assert.equal(
      applySellerTone(
        `${greeting} M bedenin boyu 74 cm.`,
        'question',
        preferences,
      ),
      'M bedenin boyu 74 cm.',
    );
  }
});

void test('missing catalog lining information cannot prove either the presence or absence of fleece', async () => {
  for (const question of ['Merhaba içi polar mı', 'Merhaba içi polarmı']) {
    const answerContext = context(question);
    const result = await draft(
      answerContext,
      'Ürünün içi polar değildir; pamuklu yapıdadır.',
    );
    assert.equal(result.decision, 'NEEDS_REVIEW');
    assert.ok(result.risks.includes('UNSUPPORTED_CLAIM'));
    assert.ok(result.missingInformation.some((item) => /polar/.test(item)));
  }
});
