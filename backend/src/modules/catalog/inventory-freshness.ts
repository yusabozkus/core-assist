export const DEFAULT_INVENTORY_FRESHNESS_MAX_AGE_MS = 15 * 60 * 1_000;

export type InventoryFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';

export function getInventoryFreshnessMaxAgeMs() {
  const configured = Number(process.env.INVENTORY_FRESHNESS_MAX_AGE_MS);

  return Number.isFinite(configured) && configured >= 60_000
    ? configured
    : DEFAULT_INVENTORY_FRESHNESS_MAX_AGE_MS;
}

export function getInventoryFreshnessCutoff(now = new Date()) {
  return new Date(now.getTime() - getInventoryFreshnessMaxAgeMs());
}

export function resolveInventoryFreshness(
  lastSyncedAt: Date | null,
  cutoff: Date,
): InventoryFreshness {
  if (!lastSyncedAt) return 'UNKNOWN';
  return lastSyncedAt >= cutoff ? 'FRESH' : 'STALE';
}
