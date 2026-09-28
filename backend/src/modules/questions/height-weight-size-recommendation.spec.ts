import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GeminiDraftService } from '../ai/gemini-draft.service';
import type { GeminiClientService } from '../ai/gemini-client.service';
import { evaluateAutoSendEligibility } from './ai-auto-send-policy';
import { applyHeightWeightSizeRecommendation } from './height-weight-size-recommendation';
import { analyzeProductQuestion } from './product-answer-context.service';
import type { ProductAnswerContext } from './product-answer-context.types';
import { QuestionReplyDecisionService } from './question-reply-decision.service';

const preferences = {
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

function contextFor(
  question: string,
  options: {
    enabled?: boolean;
    sizes?: string[];
    category?: string;
  } = {},
) {
  const context = analyzeProductQuestion({
    questionId: 'height-weight-estimate-test',
    question,
    product: {
      id: 'garment-test',
      title: 'Kadın regular tişört',
      description: null,
      brand: null,
      category: options.category ?? 'Tişört',
      attributes: [],
      variants: (options.sizes ?? ['M', 'L', 'XL']).map((size) => ({
        title: null,
        sku: `SKU-${size}`,
        color: 'Siyah',
        size,
        price: 300,
        currency: 'TRY',
        stock: 10,
        status: 'ACTIVE' as const,
        lastSyncedAt: new Date().toISOString(),
      })),
    },
  });
  return applyHeightWeightSizeRecommendation({
    ...context,
    responsePreferences: {
      ...preferences,
      heightWeightSizeRecommendationEnabled: options.enabled ?? true,
    },
  });
}

function generatorWithEstimate(
  estimatedSize: string,
  options: {
    answer?: string;
    confidence?: number;
    usedEvidenceIds?: string[];
  } = {},
) {
  const client = {
    isEnabled: () => true,
    generate: () =>
      Promise.resolve(
        JSON.stringify({
          answer: options.answer ?? `${estimatedSize} beden kesin olur.`,
          interpretation: 'Boy ve kiloya göre beden',
          scope: 'IN_SCOPE',
          detectedFacts: ['SIZE'],
          answerability: 'FULL',
          decision: 'DRAFT',
          confidence: options.confidence ?? 0.99,
          usedEvidenceIds: options.usedEvidenceIds ?? ['variant-sizes'],
          missingInformation: [],
          estimatedSize,
        }),
      ),
  } as unknown as GeminiClientService;
  return new GeminiDraftService(client);
}

void test('opted-in height and weight produce an explicitly estimated listed size', async () => {
  const context = contextFor('181 boy 80 kg hangi beden?');
  assert.equal(
    context.heightWeightSizeRecommendation?.status,
    'ESTIMATE_ALLOWED',
  );
  assert.equal(context.heightWeightSizeRecommendation.customerHeightCm, 181);
  assert.equal(context.heightWeightSizeRecommendation.customerWeightKg, 80);
  assert.deepEqual(context.heightWeightSizeRecommendation.recommendedSizes, [
    'M',
    'L',
    'XL',
  ]);

  const draft = await generatorWithEstimate('L').generate(context);
  assert.ok(draft);
  assert.match(draft.answer, /L beden size uygun olabilir/);
  assert.match(draft.answer, /tahmini bir öneridir/);
  assert.doesNotMatch(draft.answer, /kesin olur/);
  assert.deepEqual(draft.usedEvidenceIds, ['variant-sizes']);
  assert.equal(draft.confidence, 0.85);

  const decision = new QuestionReplyDecisionService().evaluate(draft);
  assert.equal(decision, 'READY_FOR_SEND');
  const auto = evaluateAutoSendEligibility({
    draft,
    decision,
    requestedFacts: context.requestedFacts,
    storeMinimumConfidence: 0.85,
    allowHeightWeightRecommendation: true,
  });
  assert.equal(auto.eligible, true);
  assert.equal(auto.appliedConfidenceThreshold, 0.85);
  assert.equal(
    evaluateAutoSendEligibility({
      draft,
      decision,
      requestedFacts: context.requestedFacts,
      storeMinimumConfidence: 0.85,
      allowHeightWeightRecommendation: false,
    }).eligible,
    false,
  );
  assert.equal(
    evaluateAutoSendEligibility({
      draft,
      decision,
      requestedFacts: context.requestedFacts,
      storeMinimumConfidence: 0.9,
      allowHeightWeightRecommendation: true,
    }).eligible,
    false,
  );
});

void test('a guide-backed match is still described as an estimate', async () => {
  const base = contextFor('193 boy 102 kg hangi beden?', { sizes: ['XXL'] });
  const context = applyHeightWeightSizeRecommendation({
    ...base,
    product: {
      ...base.product,
      sizeGuides: [
        {
          id: 'guide',
          sourceUrl: 'https://example.test/guide',
          normalizedText: 'XXL: boy 190-200 cm, kilo 96-110 kg',
          confidence: 1,
          structuredData: {
            unit: 'CM',
            headers: ['Boy', 'Kilo'],
            rows: [
              {
                label: 'XXL',
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
    },
  });
  assert.equal(context.heightWeightSizeRecommendation?.status, 'MATCHED');
  const draft = await generatorWithEstimate('XXL', {
    usedEvidenceIds: ['height-weight-size-guide'],
  }).generate(context);
  assert.ok(draft);
  assert.match(draft.answer, /XXL beden size uygun olabilir/);
  assert.match(draft.answer, /tahmini bir öneridir/);
  assert.doesNotMatch(draft.answer, /kesin olur/);
  const decision = new QuestionReplyDecisionService().evaluate(draft);
  assert.equal(decision, 'READY_FOR_SEND');
  assert.equal(
    evaluateAutoSendEligibility({
      draft,
      decision,
      requestedFacts: context.requestedFacts,
      storeMinimumConfidence: 0.85,
      allowHeightWeightRecommendation: true,
    }).eligible,
    true,
  );
  assert.equal(
    applyHeightWeightSizeRecommendation({
      ...context,
      question: '150 boy 102 kg hangi beden?',
    }).heightWeightSizeRecommendation?.status,
    'NO_MATCH',
  );
});

void test('an invented size cannot be sent as a height-weight estimate', async () => {
  const context = contextFor('181 boy 80 kg hangi beden?');
  const draft = await generatorWithEstimate('XXL').generate(context);
  assert.ok(draft);
  assert.doesNotMatch(draft.answer, /XXL/);
  assert.equal(draft.decision, 'NEEDS_REVIEW');
  assert.equal(
    new QuestionReplyDecisionService().evaluate(draft),
    'NEEDS_REVIEW',
  );
});

void test('low confidence or conflicting AI size remains under review', async () => {
  const context = contextFor('181 boy 80 kg hangi beden?');
  for (const generator of [
    generatorWithEstimate('L', { confidence: 0.7 }),
    generatorWithEstimate('L', { answer: 'XL beden kesin olur.' }),
  ]) {
    const draft = await generator.generate(context);
    assert.ok(draft);
    assert.equal(draft.decision, 'NEEDS_REVIEW');
    assert.equal(
      new QuestionReplyDecisionService().evaluate(draft),
      'NEEDS_REVIEW',
    );
  }
});

void test('disabled setting or missing body input never opens estimation', () => {
  assert.equal(
    contextFor('181 boy 80 kg hangi beden?', { enabled: false })
      .heightWeightSizeRecommendation?.status,
    'DISABLED',
  );
  assert.equal(
    contextFor('181 boy hangi beden?').heightWeightSizeRecommendation?.status,
    'MISSING_INPUT',
  );
  assert.equal(
    contextFor('181 boy 80 kg hangi beden?', { sizes: [] })
      .heightWeightSizeRecommendation?.status,
    'GUIDE_UNAVAILABLE',
  );
  assert.equal(
    contextFor('181 boy 80 kg hangi beden?', { category: 'Ayakkabı' })
      .heightWeightSizeRecommendation?.status,
    'GUIDE_UNAVAILABLE',
  );
});

void test('missing weight removes an AI size claim and asks for the missing input', async () => {
  const context = contextFor('181 boy hangi beden?');
  const draft = await generatorWithEstimate('L').generate(context);
  assert.ok(draft);
  assert.match(draft.answer, /kilo bilginizi/);
  assert.doesNotMatch(draft.answer, /L beden kesin olur/);
  assert.equal(
    new QuestionReplyDecisionService().evaluate(draft),
    'NEEDS_REVIEW',
  );
});
