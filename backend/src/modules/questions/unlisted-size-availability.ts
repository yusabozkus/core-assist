import type { ProductAnswerContext } from './product-answer-context.types';

/** A missing catalog option is not an out-of-stock variant. */
export function getUnlistedAvailabilitySize(
  context: ProductAnswerContext,
): string | null {
  if (
    !context.requestedFacts.includes('STOCK') ||
    context.requestedFacts.some(
      (fact) => fact !== 'STOCK' && fact !== 'SIZE',
    ) ||
    !context.requestedSize ||
    context.matchedSize ||
    !context.product.variants.some((variant) => Boolean(variant.size))
  ) {
    return null;
  }

  return context.requestedSize;
}
