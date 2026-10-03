export function requiresInventoryVerification(input: {
  answer: string;
  evidenceIds: unknown;
  requestedFacts?: unknown;
  detectedFacts?: unknown;
}) {
  // The deterministic unlisted-size reply reports only what the catalog lists.
  // It makes no claim about the provider's current stock, even when the
  // customer's wording was classified as a stock question.
  if (
    Array.isArray(input.evidenceIds) &&
    input.evidenceIds.length === 1 &&
    input.evidenceIds[0] === 'variant-sizes' &&
    Array.isArray(input.detectedFacts) &&
    input.detectedFacts.length === 1 &&
    input.detectedFacts[0] === 'SIZE' &&
    /^\s*(?:(?:merhaba|merhabalar),\s*)?bu ürünün listelenen beden seçenekleri arasında [^.!?]+ görünmüyor\.\s*(?:(?:keyifli alışverişler|iyi alışverişler|iyi günler) dileriz\.)?\s*$/.test(
      input.answer.toLocaleLowerCase('tr-TR'),
    )
  ) {
    return false;
  }

  return (
    (Array.isArray(input.evidenceIds) &&
      input.evidenceIds.includes('variant-stock')) ||
    (Array.isArray(input.requestedFacts) &&
      input.requestedFacts.includes('STOCK')) ||
    (Array.isArray(input.detectedFacts) &&
      input.detectedFacts.includes('STOCK'))
  );
}
