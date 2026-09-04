import {
  getInventoryFreshnessCutoff,
  resolveInventoryFreshness,
} from '../catalog/inventory-freshness';

const STOCK_EVIDENCE_ID = 'variant-stock';

export function hasFreshInventoryForAutomaticAnswer(
  evidenceIds: unknown,
  variants: Array<{ lastSyncedAt: Date | null }>,
) {
  if (!usesStockEvidence(evidenceIds)) return true;
  if (variants.length === 0) return false;

  const cutoff = getInventoryFreshnessCutoff();
  return variants.every(
    (variant) =>
      resolveInventoryFreshness(variant.lastSyncedAt, cutoff) === 'FRESH',
  );
}

function usesStockEvidence(evidenceIds: unknown) {
  return (
    Array.isArray(evidenceIds) &&
    evidenceIds.some((evidenceId) => evidenceId === STOCK_EVIDENCE_ID)
  );
}
