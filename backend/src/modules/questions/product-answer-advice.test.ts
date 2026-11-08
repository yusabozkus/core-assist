import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isPersonalSizeSelectionQuestion,
  isProductDimensionQuestion,
  resolveProductAnswerAdvice,
} from './product-answer-advice';
import type {
  ProductAnswerContext,
  ProductAnswerSizeGuideContext,
} from './product-answer-context.types';

function guide(): ProductAnswerSizeGuideContext {
  return {
    id: 'mens-jeans',
    sourceUrl: 'https://example.test/size-guide.png',
    normalizedText: 'Erkek Alt Giyim Beden Tablosu',
    confidence: 0.99,
    structuredData: {
      title: 'Erkek Alt Giyim Beden Tablosu',
      audience: 'MEN',
      measurementBasis: 'BODY',
      unit: 'CM',
      headers: ['Beden', 'Kanvas', 'Bel (cm)', 'Basen (cm)'],
      rows: [
        {
          label: 'W34',
          measurements: [
            { name: 'Kanvas', value: '44' },
            { name: 'Bel (cm)', value: '81-86' },
            { name: 'Basen (cm)', value: '95-100' },
          ],
        },
        {
          label: 'W36',
          measurements: [
            { name: 'Kanvas', value: '46' },
            { name: 'Bel (cm)', value: '86-91' },
            { name: 'Basen (cm)', value: '100-106' },
          ],
        },
      ],
      notes: [],
      confidence: 0.99,
    },
  };
}

function context(question: string): ProductAnswerContext {
  const variants: ProductAnswerContext['product']['variants'] = [
    '34',
    '36',
    '38',
  ].map((size) => ({
    title: null,
    sku: `sku-${size}`,
    color: 'Siyah',
    size,
    price: 500,
    currency: 'TRY',
    stock: 10,
    status: 'ACTIVE',
    lastSyncedAt: null,
  }));
  return {
    questionId: 'reference-size-question',
    question,
    providerKey: 'hepsiburada',
    requestedFacts: ['SIZE'],
    mentionedColors: [],
    requestedColor: null,
    requestedSize: null,
    matchedColor: null,
    matchedSize: null,
    product: {
      id: 'mens-jean',
      title: 'Erkek Regular Fit Jean Pantolon',
      description: null,
      brand: null,
      category: 'Pantolon',
      attributes: [{ name: 'Kalıp', value: 'Regular' }],
      variants,
      sizeGuides: [guide()],
    },
    matchingVariants: variants,
    inventoryFreshness: {
      status: 'UNKNOWN',
      latestSyncedAt: null,
      maxAgeMs: 300000,
    },
    relevantAttributes: [],
    relevantDescription: null,
    evidence: [
      {
        id: 'customer-size-input',
        fact: 'SIZE',
        label: 'Müşterinin ölçü bilgisi',
        value: question,
        source: 'CUSTOMER_INPUT',
      },
      {
        id: 'variant-sizes',
        fact: 'SIZE',
        label: 'Listelenen bedenler',
        value: '34, 36, 38',
        source: 'VARIANT',
      },
      {
        id: 'size-guide-mens-jeans',
        fact: 'SIZE',
        label: 'Beden tablosu',
        value: 'Kanvas 46 / W36 / Bel 86-91 cm',
        source: 'SIZE_GUIDE',
        confidence: 0.99,
      },
      {
        id: 'catalog-fit',
        fact: 'FIT',
        label: 'Kalıp',
        value: 'Kalıp: Regular',
        source: 'ATTRIBUTE',
      },
    ],
  };
}

function assertClarification(answerContext: ProductAnswerContext) {
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'CUSTOMER_CLARIFICATION');
  assert.match(advice.answer, /çevre ölçülerinizi.*paylaşabilir misiniz/);
  assert.doesNotMatch(advice.answer, /EU 46|36 beden.*uygun|W36/);
  assert.ok(advice.usedEvidenceIds.includes('customer-size-input'));
}

void test('existing cloth-trouser size uses only the chart-specific Kanvas conversion', () => {
  const answerContext = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'SIZE_GUIDANCE');
  assert.match(advice.answer, /Kanvas sütununda 46, W36/);
  assert.match(advice.answer, /listelenen 36 bedenine/);
  assert.match(advice.answer, /bel çevresi 86-91 cm/);
  assert.doesNotMatch(advice.answer, /EU|kesin|36 almalısınız/);
  assert.deepEqual(advice.usedEvidenceIds, [
    'size-guide-mens-jeans',
    'variant-sizes',
  ]);
});

void test('height-weight disabled does not suppress an explicit reference-size chart conversion', () => {
  const answerContext = context(
    '46 beden kumaş pantolon giyiyorum boyum 180 kilo 80 hangi beden almalıyım',
  );
  answerContext.heightWeightSizeRecommendation = {
    status: 'DISABLED',
    customerHeightCm: 180,
    customerWeightKg: 80,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'SIZE_GUIDANCE');
  assert.match(advice.answer, /Kanvas sütununda 46, W36/);
});

void test('legacy or garment tables can provide exact size codes without inventing body dimensions', () => {
  for (const basis of [undefined, 'UNKNOWN', 'MIXED', 'GARMENT'] as const) {
    const answerContext = context(
      '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
    );
    answerContext.product.sizeGuides![0].structuredData!.measurementBasis =
      basis;
    const advice = resolveProductAnswerAdvice(answerContext);
    assert.ok(advice);
    assert.equal(advice.responseKind, 'SIZE_GUIDANCE');
    assert.match(advice.answer, /Kanvas sütununda 46, W36/);
    assert.doesNotMatch(
      advice.answer,
      /bel çevresi|basen çevresi|86-91|100-106|Çevre ölçülerinizi de tabloyla/,
    );
  }
});

void test('unknown measurement basis still prevents body-circumference matching', () => {
  const answerContext = context('Bel 89 basen 103 hangi beden almalı');
  delete answerContext.product.sizeGuides![0].structuredData!.measurementBasis;
  assert.equal(resolveProductAnswerAdvice(answerContext), null);
});

void test('a different current size uses its actual chart row rather than a fixed conversion', () => {
  const advice = resolveProductAnswerAdvice(
    context('44 beden kanvas pantolon giyiyorum bunu kaç beden almalıyım'),
  );
  assert.ok(advice);
  assert.match(advice.answer, /Kanvas sütununda 44, W34/);
  assert.match(advice.answer, /bel çevresi 81-86 cm/);
  assert.doesNotMatch(advice.answer, /W36|86-91/);
});

void test('a generic current size never inherits the Kanvas conversion', () => {
  assertClarification(
    context('46 beden giyiyorum bunu kaç beden almam gerekli'),
  );
  assertClarification(
    context('L beden giyiyorum bu üründen hangisi uygun olur'),
  );
});

void test('missing, ambiguous, unavailable or insufficiently reliable chart mappings do not choose a size', () => {
  const missing = context(
    '48 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  assertClarification(missing);

  const unavailable = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  unavailable.product.variants = unavailable.product.variants.filter(
    (item) => item.size !== '36',
  );
  assertClarification(unavailable);

  const ambiguous = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  const first = ambiguous.product.sizeGuides![0].structuredData!;
  first.rows[0].measurements[0].value = '46';
  assertClarification(ambiguous);

  const lowConfidence = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  lowConfidence.product.sizeGuides![0].confidence = 0.7;
  assertClarification(lowConfidence);
});

void test('conflicting or incompatible size guides do not produce a conversion', () => {
  const conflicting = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  const second = guide();
  second.id = 'second-guide';
  conflicting.product.sizeGuides!.push(second);
  conflicting.evidence.push({
    id: 'size-guide-second-guide',
    fact: 'SIZE',
    label: 'İkinci tablo',
    value: '46 / 34',
    source: 'SIZE_GUIDE',
  });
  assertClarification(conflicting);

  const incompatible = context(
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
  );
  incompatible.product.sizeGuides![0].structuredData!.audience = 'WOMEN';
  assertClarification(incompatible);
});

void test('explicit EU conversion uses an EU column and never the Kanvas column', () => {
  const question = 'EU 46 hangi beden oluyor';
  assert.equal(resolveProductAnswerAdvice(context(question)), null);
  const answerContext = context(question);
  answerContext.product.sizeGuides![0].structuredData!.rows[1].measurements[0].name =
    'EU Beden Karşılığı';
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.match(advice.answer, /EU sütununda 46, W36/);
  assert.doesNotMatch(advice.answer, /Kanvas/);
});

void test('disabled height-weight selection with a verified fit asks the customer, not the merchant', () => {
  const answerContext = context(
    '180 boy 80 kilo bu kalıpta hangi beden almalıyım',
  );
  answerContext.requestedFacts = ['SIZE', 'FIT'];
  answerContext.heightWeightSizeRecommendation = {
    status: 'DISABLED',
    customerHeightCm: 180,
    customerWeightKg: 80,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'CUSTOMER_CLARIFICATION');
  assert.match(advice.answer, /regular, yani standart kesimlidir/);
  assert.match(
    advice.answer,
    /bel ve basen çevre ölçülerinizi paylaşabilir misiniz/,
  );
  assert.deepEqual(advice.usedEvidenceIds, [
    'catalog-fit',
    'customer-size-input',
  ]);
  assert.equal(advice.confidence, 0.99);
});

void test('compatible Boxy and Oversize proofs allow disabled height-weight clarification without estimating a size', () => {
  const answerContext = context(
    '176 boy 150 kg regular fit de 3xl giyiyorum bu kalıpta hangi bedeni seçmem lazım',
  );
  answerContext.requestedFacts = ['SIZE', 'FIT'];
  answerContext.heightWeightSizeRecommendation = {
    status: 'DISABLED',
    customerHeightCm: 176,
    customerWeightKg: 150,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  answerContext.evidence = answerContext.evidence.filter(
    (item) => item.fact !== 'FIT',
  );
  answerContext.evidence.push(
    {
      id: 'catalog-fit',
      fact: 'FIT',
      label: 'Kalıp',
      value: 'Kalıp: Boxy; Siluet: Oversize',
      source: 'ATTRIBUTE',
    },
    {
      id: 'fit-detail',
      fact: 'FIT',
      label: 'Kalıp',
      value: 'Boxy',
      source: 'ATTRIBUTE',
    },
    {
      id: 'silhouette-detail',
      fact: 'FIT',
      label: 'Siluet',
      value: 'Oversize',
      source: 'ATTRIBUTE',
    },
  );
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'CUSTOMER_CLARIFICATION');
  assert.match(advice.answer, /boxy formunda ve bol \(oversize\) kesimlidir/);
  assert.match(advice.answer, /çevre ölçülerinizi.*paylaşabilir misiniz/);
  assert.doesNotMatch(advice.answer, /3XL|3xl|uygun beden|tahmini.*beden/);
  assert.deepEqual(
    new Set(advice.usedEvidenceIds),
    new Set([
      'catalog-fit',
      'fit-detail',
      'silhouette-detail',
      'customer-size-input',
    ]),
  );

  answerContext.evidence.push({
    id: 'contradictory-fit',
    fact: 'FIT',
    label: 'Kalıp',
    value: 'Slim',
    source: 'ATTRIBUTE',
  });
  assert.equal(resolveProductAnswerAdvice(answerContext), null);
});

void test('unknown or conflicting fit does not get cleared by a customer-size clarification', () => {
  const answerContext = context(
    '180 boy 80 kilo bu kalıpta hangi beden almalıyım',
  );
  answerContext.requestedFacts = ['SIZE', 'FIT'];
  answerContext.heightWeightSizeRecommendation = {
    status: 'DISABLED',
    customerHeightCm: 180,
    customerWeightKg: 80,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  answerContext.evidence = answerContext.evidence.filter(
    (item) => item.fact !== 'FIT',
  );
  assert.equal(resolveProductAnswerAdvice(answerContext), null);
  answerContext.evidence.push({
    id: 'conflicting-fit',
    fact: 'FIT',
    label: 'Kalıp',
    value: 'Regular; Slim',
    source: 'ATTRIBUTE',
  });
  assert.equal(resolveProductAnswerAdvice(answerContext), null);
});

void test('body-measurement matching still works while height-weight recommendations are disabled', () => {
  const answerContext = context('Bel 89 basen 103 hangi beden almalı');
  answerContext.heightWeightSizeRecommendation = {
    status: 'DISABLED',
    customerHeightCm: null,
    customerWeightKg: null,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  const advice = resolveProductAnswerAdvice(answerContext);
  assert.ok(advice);
  assert.equal(advice.responseKind, 'SIZE_GUIDANCE');
  assert.match(advice.answer, /89 cm bel çevreniz.*36 beden/);
});

void test('product dimensions and genuine mixed intents remain reviewable despite a current size reference', () => {
  for (const question of [
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almalıyım ve paça boyu kaç cm',
    'L beden giyiyorum bunun boyu kısa mı',
    'M beden giyiyorum normal tişörtlere göre daha uzun mu',
  ]) {
    assert.equal(resolveProductAnswerAdvice(context(question)), null, question);
  }
  for (const fact of [
    'MATERIAL',
    'DURABILITY',
    'STOCK',
    'CARE',
    'RETURN',
    'PRODUCT_INFO',
  ] as const) {
    const answerContext = context(
      '46 beden kumaş pantolon giyiyorum bunu kaç beden almalıyım',
    );
    answerContext.requestedFacts.push(fact);
    assert.equal(resolveProductAnswerAdvice(answerContext), null, fact);
  }
});

void test('dimension and personal-selection classifiers distinguish garment length from customer height', () => {
  assert.equal(
    isProductDimensionQuestion(
      'Bedeni normal tişörtlere göre yani oversize olmayanlara göre boyu kısa mı',
    ),
    true,
  );
  assert.equal(
    isProductDimensionQuestion('Boyum 170 kilo 73 hangi beden almalıyım'),
    false,
  );
  assert.equal(
    isPersonalSizeSelectionQuestion(
      '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
    ),
    true,
  );
  assert.equal(
    isPersonalSizeSelectionQuestion('XL göğüs genişliği nedir'),
    false,
  );
});
