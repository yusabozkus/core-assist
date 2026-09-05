export function requiresInventoryVerification(input: {
  evidenceIds: unknown;
  requestedFacts?: unknown;
  detectedFacts?: unknown;
}) {
  return (
    (Array.isArray(input.evidenceIds) &&
      input.evidenceIds.includes('variant-stock')) ||
    (Array.isArray(input.requestedFacts) &&
      input.requestedFacts.includes('STOCK')) ||
    (Array.isArray(input.detectedFacts) &&
      input.detectedFacts.includes('STOCK'))
  );
}
