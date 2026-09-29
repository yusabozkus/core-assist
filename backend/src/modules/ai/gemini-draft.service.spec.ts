import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AiDraftResult } from './ai-draft.types';
import type { ProductAnswerContext } from '../questions/product-answer-context.types';
import { evaluateAutoSendEligibility } from '../questions/ai-auto-send-policy';
import { extractProductKnowledgeGaps } from '../questions/product-knowledge-gap';
import { QuestionReplyDecisionService } from '../questions/question-reply-decision.service';
import { applyHeightWeightSizeRecommendation } from '../questions/height-weight-size-recommendation';
import { GeminiClientService } from './gemini-client.service';
import { GeminiDraftService } from './gemini-draft.service';

const variants: ProductAnswerContext['product']['variants'] = [
  {
    title: null,
    sku: 'M',
    color: null,
    size: 'M',
    price: 300,
    currency: 'TRY',
    stock: 9,
    status: 'ACTIVE',
    lastSyncedAt: null,
  },
  {
    title: null,
    sku: 'L',
    color: null,
    size: 'L',
    price: 300,
    currency: 'TRY',
    stock: 9,
    status: 'ACTIVE',
    lastSyncedAt: null,
  },
];

function context(question: string): ProductAnswerContext {
  return {
    questionId: 'question-id',
    question,
    providerKey: 'trendyol',
    requestedFacts: ['SIZE'],
    mentionedColors: [],
    requestedColor: null,
    requestedSize: null,
    matchedColor: null,
    matchedSize: null,
    product: {
      id: 'product-id',
      title: 'Jogger Pantolon',
      description: null,
      brand: null,
      category: 'Pantolon',
      attributes: [],
      variants,
      sizeGuides: [],
    },
    matchingVariants: variants,
    inventoryFreshness: {
      status: 'FRESH',
      latestSyncedAt: null,
      maxAgeMs: 300000,
    },
    relevantAttributes: [],
    relevantDescription: null,
    evidence: [
      {
        id: 'variant-sizes',
        fact: 'SIZE',
        label: 'Listelenen bedenler',
        value: 'M, L',
        source: 'VARIANT',
      },
    ],
  };
}

function modelOutput(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    answer: 'Bu beden için ölçülerinizi karşılaştırmanızı öneririz.',
    interpretation: 'Beden önerisi',
    scope: 'IN_SCOPE',
    detectedFacts: ['SIZE'],
    answerability: 'PARTIAL',
    decision: 'NEEDS_REVIEW',
    confidence: 0.8,
    usedEvidenceIds: ['variant-sizes'],
    missingInformation: [],
    ...overrides,
  });
}

async function generate(
  answerContext: ProductAnswerContext,
  output: string,
): Promise<AiDraftResult> {
  const client = {
    isEnabled: () => true,
    generate: () => Promise.resolve(output),
  } as unknown as GeminiClientService;
  const draft = await new GeminiDraftService(client).generate(answerContext);
  assert.ok(draft);
  return draft;
}

function eligibility(
  draft: AiDraftResult,
  answerContext: ProductAnswerContext,
  storeMinimumConfidence = 0.85,
) {
  const decision = new QuestionReplyDecisionService().evaluate(draft);
  return {
    decision,
    policy: evaluateAutoSendEligibility({
      draft,
      decision,
      requestedFacts: answerContext.requestedFacts,
      storeMinimumConfidence,
      allowHeightWeightRecommendation:
        answerContext.heightWeightSizeRecommendation?.status ===
          'ESTIMATE_ALLOWED' ||
        answerContext.heightWeightSizeRecommendation?.status === 'MATCHED',
    }),
  };
}

void test('unlisted size response qualifies for safe auto-send', async () => {
  const answerContext = context('44 yokmu acaba');
  answerContext.requestedFacts = ['STOCK', 'SIZE'];
  answerContext.requestedSize = '44';
  const draft = await generate(answerContext, modelOutput());

  assert.match(draft.answer, /44 görünmüyor/);
  assert.doesNotMatch(draft.answer, /tükendi|stokta yok/i);
  assert.equal(eligibility(draft, answerContext).decision, 'READY_FOR_SEND');
  assert.equal(eligibility(draft, answerContext).policy.eligible, true);
});

void test('missing customer height gets safe clarification without a merchant knowledge gap', async () => {
  const answerContext = context('53 kg kaç beden almalı');
  answerContext.evidence.push({
    id: 'size-guide',
    fact: 'SIZE',
    label: 'Beden tablosu',
    value: 'Bel ve basen ölçüleri',
    source: 'SIZE_GUIDE',
  });
  answerContext.heightWeightSizeRecommendation = {
    status: 'MISSING_INPUT',
    customerHeightCm: null,
    customerWeightKg: 53,
    recommendedSizes: [],
    requiredMeasurements: ['Bel', 'Basen'],
    sourceEvidenceId: null,
  };
  const draft = await generate(
    answerContext,
    modelOutput({
      confidence: 0.6,
      missingInformation: [
        'Müşterinin boy bilgisi ve vücut ölçüleri (bel, basen)',
        'Boy ve kiloya göre doğrulanmış beden eşleşmesi',
      ],
    }),
  );

  assert.match(draft.answer, /boy bilginizi paylaşmanızı/);
  assert.deepEqual(draft.missingInformation, []);
  assert.deepEqual(draft.risks, []);
  assert.equal(eligibility(draft, answerContext).policy.eligible, true);
  assert.deepEqual(
    extractProductKnowledgeGaps({
      question: answerContext.question,
      missingInformation: [
        'Müşterinin boy bilgisi ve vücut ölçüleri (bel, basen)',
        'Boy ve kiloya göre doğrulanmış beden eşleşmesi',
        'Ürünün bel ölçüsü',
        'Bel ölçüsü',
      ],
      requestedFacts: ['SIZE'],
    }).map((gap) => gap.label),
    ['Ürünün bel ölçüsü'],
  );
  assert.deepEqual(
    extractProductKnowledgeGaps({
      question: answerContext.question,
      missingInformation: ['Bel ölçüsü'],
      requestedFacts: ['SIZE'],
    }).map((gap) => gap.label),
    ['Bel ölçüsü'],
  );

  const noGuideContext = context(answerContext.question);
  noGuideContext.heightWeightSizeRecommendation =
    answerContext.heightWeightSizeRecommendation;
  const noGuideDraft = await generate(
    noGuideContext,
    modelOutput({
      confidence: 0.6,
      missingInformation: ['Müşterinin boy bilgisi'],
    }),
  );
  assert.equal(
    eligibility(noGuideDraft, noGuideContext).policy.eligible,
    false,
  );

  const disabledContext = context(answerContext.question);
  disabledContext.evidence.push(answerContext.evidence[1]);
  disabledContext.heightWeightSizeRecommendation = {
    ...answerContext.heightWeightSizeRecommendation,
    status: 'DISABLED',
  };
  const disabledDraft = await generate(
    disabledContext,
    modelOutput({ confidence: 0.6 }),
  );
  assert.doesNotMatch(disabledDraft.answer, /\b(?:M|L) beden\b/);
  assert.equal(
    eligibility(disabledDraft, disabledContext).policy.eligible,
    true,
  );
});

void test('caveated listed-size estimate qualifies only when enabled and sufficiently confident', async () => {
  const answerContext = context('181 boy 80 kg hangi beden');
  answerContext.heightWeightSizeRecommendation = {
    status: 'ESTIMATE_ALLOWED',
    customerHeightCm: 181,
    customerWeightKg: 80,
    recommendedSizes: ['M', 'L'],
    requiredMeasurements: ['Göğüs', 'Bel'],
    sourceEvidenceId: 'variant-sizes',
  };
  const output = modelOutput({
    answer: 'L beden size uygun olabilir; bu tahmini bir öneridir.',
    estimatedSize: 'L',
    missingInformation: [
      'Göğüs, bel ve basen çevre ölçüleri',
      'Göğüs veya Bel ölçüsüyle beden teyidi',
    ],
  });
  const draft = await generate(answerContext, output);

  assert.match(draft.answer, /L beden.*tahmini/);
  assert.deepEqual(draft.missingInformation, []);
  assert.equal(eligibility(draft, answerContext).policy.eligible, true);
  assert.equal(eligibility(draft, answerContext, 0.95).policy.eligible, false);

  const unsafe = await generate(
    answerContext,
    modelOutput({
      answer: 'L beden uygun olabilir.',
      estimatedSize: 'L',
      missingInformation: ['Ürünün beden tablosu'],
    }),
  );
  assert.equal(eligibility(unsafe, answerContext).policy.eligible, false);

  const numericContext = context('181 boy 80 kg hangi beden');
  const recommendation = answerContext.heightWeightSizeRecommendation;
  assert.ok(recommendation);
  numericContext.heightWeightSizeRecommendation = {
    ...recommendation,
    recommendedSizes: ['40', '42'],
  };
  const numericDraft = await generate(
    numericContext,
    modelOutput({
      answer: '42 beden uygun olabilir; tahmini bir öneridir.',
      estimatedSize: '42',
      missingInformation: [
        'EU Beden Karşılığı veya Bel ölçüsüyle beden teyidi',
      ],
    }),
  );
  assert.equal(eligibility(numericDraft, numericContext).policy.eligible, true);

  const lowConfidenceDraft = await generate(
    numericContext,
    modelOutput({
      answer: '42 beden uygun olabilir; tahmini bir öneridir.',
      estimatedSize: '42',
      confidence: 0.7,
      missingInformation: ['Bel ölçüsüyle beden teyidi'],
    }),
  );
  assert.equal(
    eligibility(lowConfidenceDraft, numericContext).policy.eligible,
    false,
  );
});

void test('Turkish kilo suffix is parsed and missing mannequin data remains in review', async () => {
  const answerContext = context(
    'manken bilgileri nedir 180 70 kiloya hangi beden alınmalı',
  );
  answerContext.responsePreferences = {
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
  };
  const enriched = applyHeightWeightSizeRecommendation(answerContext);
  assert.equal(
    enriched.heightWeightSizeRecommendation?.status,
    'ESTIMATE_ALLOWED',
  );
  assert.equal(enriched.heightWeightSizeRecommendation?.customerHeightCm, 180);
  assert.equal(enriched.heightWeightSizeRecommendation?.customerWeightKg, 70);

  const draft = await generate(
    enriched,
    modelOutput({
      answer: 'M beden uygun olabilir; tahmini bir öneridir.',
      estimatedSize: 'M',
      detectedFacts: ['SIZE', 'PRODUCT_INFO'],
      answerability: 'PARTIAL',
      missingInformation: ['Mankenin ölçüleri'],
    }),
  );
  assert.match(draft.answer, /Mankenin ölçüleri/);
  assert.match(draft.answer, /M beden.*tahmini/);
  assert.deepEqual(draft.missingInformation, [
    'Mankenin ölçüleri ve giydiği beden bilgisi',
  ]);
  assert.equal(eligibility(draft, enriched).policy.eligible, false);
});
