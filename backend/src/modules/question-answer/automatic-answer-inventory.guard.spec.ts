import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requiresInventoryVerification } from './automatic-answer-inventory.guard';

void test('unlisted catalog size does not require live stock verification', () => {
  const answer =
    'Merhabalar, Bu ürünün listelenen beden seçenekleri arasında 44 görünmüyor. İyi günler dileriz.';
  const input = {
    answer,
    evidenceIds: ['variant-sizes'],
    requestedFacts: ['STOCK', 'SIZE'],
    detectedFacts: ['SIZE'],
  };

  assert.equal(requiresInventoryVerification(input), false);
  assert.equal(
    requiresInventoryVerification({
      ...input,
      answer: `${answer} 44 stokta yok.`,
    }),
    true,
  );
  assert.equal(
    requiresInventoryVerification({
      ...input,
      evidenceIds: ['variant-sizes', 'variant-stock'],
    }),
    true,
  );
  assert.equal(
    requiresInventoryVerification({ ...input, detectedFacts: ['STOCK'] }),
    true,
  );
});
