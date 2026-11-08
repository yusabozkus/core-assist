import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AiDraftResult } from '../ai/ai-draft.types';
import {
  evaluateAutoSendEligibility,
  getIntentConfidenceFloor,
} from './ai-auto-send-policy';
import type { ProductAnswerFact } from './product-answer-context.types';

function draft(overrides: Partial<AiDraftResult> = {}): AiDraftResult {
  return {
    responseKind: 'CUSTOMER_CLARIFICATION',
    answer: 'Bel ve basen çevre ölçülerinizi paylaşabilir misiniz?',
    interpretation: 'Müşteriden beden karşılaştırması için ölçü isteme',
    scope: 'IN_SCOPE',
    detectedFacts: ['SIZE'],
    answerability: 'FULL',
    decision: 'DRAFT',
    confidence: 0.95,
    usedFacts: ['SIZE'],
    usedEvidenceIds: ['customer-size-input'],
    missingInformation: [],
    risks: [],
    source: 'GEMINI',
    model: 'test-model',
    ...overrides,
  };
}

function eligibility(
  candidate: AiDraftResult,
  {
    requestedFacts = ['SIZE'] as ProductAnswerFact[],
    decision = 'READY_FOR_SEND' as const,
    storeMinimumConfidence = 0.85,
    allowHeightWeightRecommendation = false,
  }: {
    requestedFacts?: ProductAnswerFact[];
    decision?: 'READY_FOR_SEND' | 'NEEDS_REVIEW';
    storeMinimumConfidence?: number;
    allowHeightWeightRecommendation?: boolean;
  } = {},
) {
  return evaluateAutoSendEligibility({
    draft: candidate,
    decision,
    requestedFacts,
    storeMinimumConfidence,
    allowHeightWeightRecommendation,
  });
}

void test('server-resolved customer clarification does not inherit the personal-size fit threshold', () => {
  const result = eligibility(draft({ confidence: 0.85 }));
  assert.equal(result.eligible, true);
  assert.equal(result.appliedConfidenceThreshold, 0.85);
  assert.deepEqual(result.reasons, []);
  assert.equal(getIntentConfidenceFloor('SIZE'), 0.98);
});

void test('clarification with catalog fit preserves the fit confidence floor', () => {
  const candidate = draft({
    detectedFacts: ['SIZE', 'FIT'],
    usedFacts: ['SIZE', 'FIT'],
    usedEvidenceIds: ['customer-size-input', 'catalog-fit'],
    confidence: 0.93,
  });
  const result = eligibility(candidate, { requestedFacts: ['SIZE', 'FIT'] });
  assert.equal(result.eligible, true);
  assert.equal(result.appliedConfidenceThreshold, 0.93);
  assert.equal(
    eligibility(
      { ...candidate, confidence: 0.92 },
      {
        requestedFacts: ['SIZE', 'FIT'],
      },
    ).eligible,
    false,
  );
});

void test('verified table guidance qualifies at 95 percent without weakening other size answers', () => {
  const candidate = draft({
    responseKind: 'SIZE_GUIDANCE',
    answer: 'Beden tablosunda bu beden için bel çevresi 80–84 cm belirtiliyor.',
    usedEvidenceIds: ['size-guide-test', 'variant-sizes'],
  });
  const result = eligibility(candidate);
  assert.equal(result.eligible, true);
  assert.equal(result.appliedConfidenceThreshold, 0.95);
  assert.equal(eligibility({ ...candidate, confidence: 0.94 }).eligible, false);
  assert.equal(
    eligibility({ ...candidate, responseKind: undefined })
      .appliedConfidenceThreshold,
    0.98,
  );
});

void test('ordinary size answers retain the strict confidence floor', () => {
  const result = eligibility(draft({ responseKind: undefined }));
  assert.equal(result.eligible, false);
  assert.equal(result.appliedConfidenceThreshold, 0.98);
  assert.deepEqual(result.reasons, ['LOW_CONFIDENCE']);
});

void test('server-parsed garment measurements qualify without trusting a raw description', () => {
  const candidate = draft({
    responseKind: 'SIZE_GUIDANCE',
    answer: 'Ürün açıklamasında M beden için ürün boyu 74 cm belirtiliyor.',
    usedEvidenceIds: ['catalog-garment-lengths', 'catalog-fit'],
    detectedFacts: ['SIZE', 'FIT'],
    usedFacts: ['SIZE', 'FIT'],
  });
  const result = eligibility(candidate, { requestedFacts: ['SIZE', 'FIT'] });
  assert.equal(result.eligible, true);
  assert.equal(result.appliedConfidenceThreshold, 0.95);
  const unparsed = eligibility({
    ...candidate,
    usedEvidenceIds: ['catalog-description-size'],
  });
  assert.equal(unparsed.eligible, false);
  assert.equal(unparsed.appliedConfidenceThreshold, 0.98);
});

void test('known persisted Turkish fit evidence identifiers preserve the verified size guidance floor', () => {
  const candidate = draft({
    responseKind: 'SIZE_GUIDANCE',
    answer:
      'Ürün oversize kesimlidir. Katalogda M beden boyu 74 cm belirtiliyor.',
    usedEvidenceIds: [
      'catalog-garment-lengths',
      'catalog-description-fıt',
      'relevant-attribute-1-fıt',
    ],
    detectedFacts: ['SIZE', 'FIT'],
    usedFacts: ['SIZE', 'FIT'],
  });
  const result = eligibility(candidate, { requestedFacts: ['SIZE', 'FIT'] });
  assert.equal(result.eligible, true);
  assert.equal(result.appliedConfidenceThreshold, 0.95);
  const unknown = eligibility({
    ...candidate,
    usedEvidenceIds: ['catalog-garment-lengths', 'unknown-fıt-source'],
  });
  assert.equal(unknown.eligible, false);
  assert.equal(unknown.appliedConfidenceThreshold, 0.98);
});

void test('a response kind with only catalog sizes is not proof of clarification or table guidance', () => {
  for (const responseKind of [
    'CUSTOMER_CLARIFICATION',
    'SIZE_GUIDANCE',
  ] as const) {
    const result = eligibility(
      draft({ responseKind, usedEvidenceIds: ['variant-sizes'] }),
    );
    assert.equal(result.eligible, false);
    assert.equal(result.appliedConfidenceThreshold, 0.98);
  }
});

void test('unknown evidence cannot lower the size confidence floor', () => {
  const candidates = [
    draft({ usedEvidenceIds: ['unknown-source'] }),
    draft({
      responseKind: 'SIZE_GUIDANCE',
      usedEvidenceIds: ['size-guide-test', 'unknown-source'],
    }),
    draft({
      responseKind: 'SIZE_GUIDANCE',
      usedEvidenceIds: ['size-guide-'],
    }),
  ];
  for (const candidate of candidates) {
    const result = eligibility(candidate);
    assert.equal(result.eligible, false);
    assert.equal(result.appliedConfidenceThreshold, 0.98);
  }
});

void test('proofless clarification is never eligible even with maximum confidence', () => {
  const result = eligibility(draft({ usedEvidenceIds: [], confidence: 0.99 }));
  assert.equal(result.eligible, false);
  assert.equal(result.appliedConfidenceThreshold, 0.98);
  assert.ok(result.reasons.includes('MISSING_EVIDENCE'));
});

void test('unrelated requested, detected or used facts retain their strict policy', () => {
  const candidates = [
    {
      candidate: draft(),
      requestedFacts: ['SIZE', 'SHIPPING'] as ProductAnswerFact[],
    },
    {
      candidate: draft({ detectedFacts: ['SIZE', 'SHIPPING'] }),
      requestedFacts: ['SIZE'] as ProductAnswerFact[],
    },
    {
      candidate: draft({ usedFacts: ['SIZE', 'MATERIAL'] }),
      requestedFacts: ['SIZE'] as ProductAnswerFact[],
    },
  ];
  for (const { candidate, requestedFacts } of candidates) {
    const result = eligibility(candidate, { requestedFacts });
    assert.equal(result.eligible, false);
    assert.equal(result.appliedConfidenceThreshold, 0.98);
  }
});

void test('genuine risks, missing product information and incomplete answers still require review', () => {
  const candidates = [
    draft({ risks: ['UNSUPPORTED_CLAIM'] }),
    draft({ risks: ['STALE_INVENTORY'] }),
    draft({ missingInformation: ['Ürünün doğrulanmış boy ölçüsü'] }),
    draft({ answerability: 'PARTIAL' }),
  ];
  for (const candidate of candidates) {
    const result = eligibility(candidate);
    assert.equal(result.eligible, false);
    assert.equal(result.appliedConfidenceThreshold, 0.98);
  }
  const review = eligibility(draft(), { decision: 'NEEDS_REVIEW' });
  assert.equal(review.eligible, false);
  assert.ok(review.reasons.includes('REVIEW_REQUIRED'));
});

void test('the store minimum overrides both clarification and table guidance floors', () => {
  for (const candidate of [
    draft(),
    draft({
      responseKind: 'SIZE_GUIDANCE',
      usedEvidenceIds: ['size-guide-test'],
    }),
  ]) {
    const result = eligibility(candidate, { storeMinimumConfidence: 0.99 });
    assert.equal(result.eligible, false);
    assert.equal(result.appliedConfidenceThreshold, 0.99);
    assert.ok(result.reasons.includes('LOW_CONFIDENCE'));
  }
});

void test('the enabled height-weight estimate policy remains separate from safe clarification', () => {
  const candidate = draft({
    responseKind: 'SIZE_ESTIMATE',
    answer: 'L beden uygun olabilir; bu yalnızca tahmini bir öneridir.',
    usedEvidenceIds: ['variant-sizes'],
    confidence: 0.85,
  });
  assert.equal(
    eligibility(candidate, { allowHeightWeightRecommendation: true }).eligible,
    true,
  );
  const disabled = eligibility(candidate);
  assert.equal(disabled.eligible, false);
  assert.equal(disabled.appliedConfidenceThreshold, 0.98);
});
