import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GeminiDraftService } from '../ai/gemini-draft.service';
import type { GeminiClientService } from '../ai/gemini-client.service';
import { analyzeProductQuestion } from './product-answer-context.service';
import { getUnlistedAvailabilitySize } from './unlisted-size-availability';

const variants = [
  {
    title: null,
    sku: 'PANTOLON-28',
    color: 'Haki',
    size: '28',
    price: 300,
    currency: 'TRY',
    stock: 9,
    status: 'ACTIVE' as const,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    title: null,
    sku: 'PANTOLON-40',
    color: 'Haki',
    size: '40',
    price: 300,
    currency: 'TRY',
    stock: 0,
    status: 'OUT_OF_STOCK' as const,
    lastSyncedAt: new Date().toISOString(),
  },
];

function contextFor(question: string) {
  return analyzeProductQuestion({
    questionId: 'size-availability-test',
    question,
    providerKey: 'trendyol',
    product: {
      id: 'pantolon-test',
      title: 'Haki pantolon',
      description: null,
      brand: null,
      category: 'Pantolon',
      attributes: [],
      variants,
    },
  });
}

function generatorWithAnswer(answer: string) {
  const client = {
    isEnabled: () => true,
    generate: () =>
      Promise.resolve(
        JSON.stringify({
          answer,
          interpretation: 'Sorulan bedenin bulunabilirliği',
          scope: 'IN_SCOPE',
          detectedFacts: ['STOCK', 'SIZE'],
          answerability: 'PARTIAL',
          decision: 'NEEDS_REVIEW',
          confidence: 0.6,
          usedEvidenceIds: ['variant-sizes'],
          missingInformation: ['Güncel stok durumu'],
        }),
      ),
  } as unknown as GeminiClientService;
  return new GeminiDraftService(client);
}

void test('unlisted 44 is an absent size option, not an unknown or sold-out stock state', async () => {
  const context = contextFor('44 yokmu acabaa');
  assert.deepEqual(context.requestedFacts, ['STOCK', 'SIZE']);
  assert.equal(context.requestedSize, '44');
  assert.equal(context.matchedSize, null);
  assert.equal(context.matchingVariants.length, 0);
  assert.equal(getUnlistedAvailabilitySize(context), '44');
  assert.match(
    context.evidence.find((item) => item.id === 'variant-stock')?.value ?? '',
    /eşleşmiyor/,
  );

  const draft = await generatorWithAnswer(
    '44 beden stoklarımızda bulunmamaktadır. Stok durumunu teyit edemiyoruz.',
  ).generate(context);
  assert.ok(draft);
  assert.match(
    draft.answer,
    /listelenen beden seçenekleri arasında 44 görünmüyor/,
  );
  assert.doesNotMatch(draft.answer, /stok|tükendi|teyit/i);
  assert.equal(draft.answerability, 'FULL');
  assert.equal(draft.decision, 'DRAFT');
  assert.deepEqual(draft.usedEvidenceIds, ['variant-sizes']);
  assert.deepEqual(draft.missingInformation, []);
});

void test('listed but sold-out size remains a stock question', () => {
  const context = contextFor('40 beden var mı');
  assert.equal(context.matchedSize, '40');
  assert.equal(getUnlistedAvailabilitySize(context), null);
  assert.match(
    context.evidence.find((item) => item.id === 'variant-stock')?.value ?? '',
    /Haki \/ 40: stokta yok/,
  );
});

void test('a measurement question for an unlisted size is not rewritten as availability', () => {
  const context = contextFor('44 beden paça boyu kaç cm?');
  assert.equal(context.requestedSize, '44');
  assert.equal(getUnlistedAvailabilitySize(context), null);
});
