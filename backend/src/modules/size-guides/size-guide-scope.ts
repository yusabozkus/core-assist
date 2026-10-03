export type SizeGuideProduct = {
  title: string;
  category: string | null;
  attributes: Array<{ name: string; value: string }>;
};

export const SIZE_GUIDE_EXTRACTION_VERSION = 2;

export function normalizeSizeText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,/+-]+/g, ' ')
    .trim();
}

export function getSizeGuideAudience(text: string): string {
  const normalized = normalizeSizeText(text);
  if (/bebek|baby/.test(normalized)) return 'BABY';
  if (/erkek cocuk|boys?\b/.test(normalized)) return 'BOYS';
  if (/kiz cocuk|girls?\b/.test(normalized)) return 'GIRLS';
  if (/unisex|uniseks/.test(normalized)) return 'UNISEX';
  if (/kadin|women|female/.test(normalized)) return 'WOMEN';
  if (/erkek|\bmen\b|\bmale\b/.test(normalized)) return 'MEN';
  return 'UNKNOWN';
}

export function getSizeGuideScope(product: SizeGuideProduct) {
  const gender = product.attributes
    .filter((attribute) =>
      /cinsiyet|gender/.test(normalizeSizeText(attribute.name)),
    )
    .map((attribute) => attribute.value)
    .join(' ');
  const explicitAudience = getSizeGuideAudience(gender);
  const audience =
    explicitAudience === 'UNKNOWN'
      ? getSizeGuideAudience(`${product.title} ${product.category ?? ''}`)
      : explicitAudience;
  const category = normalizeSizeText(
    `${product.category ?? ''} ${product.title}`,
  );
  const section = /\b(?:pantolon|jean|sort|etek|tayt)\b/.test(category)
    ? 'BOTTOM'
    : /ayakkabi|terlik|bot\b|cizme/.test(category)
      ? 'FOOTWEAR'
      : 'CLOTHING';
  return {
    audience,
    section,
    key: `v${SIZE_GUIDE_EXTRACTION_VERSION}:${audience}:${section}`,
  };
}

export function isSizeGuideCompatible(
  product: SizeGuideProduct,
  data: { title?: string; audience?: string } | null,
) {
  if (!data) return true;
  const expected = getSizeGuideScope(product).audience;
  const expectedSection = getSizeGuideScope(product).section;
  const title = normalizeSizeText(data.title ?? '');
  if (expectedSection === 'CLOTHING' && /alt giyim/.test(title)) return false;
  if (expectedSection === 'BOTTOM' && /ust giyim/.test(title)) return false;
  const titleAudience = getSizeGuideAudience(data.title ?? '');
  const actual =
    data.audience && data.audience !== 'UNKNOWN'
      ? data.audience
      : titleAudience;
  if (
    titleAudience !== 'UNKNOWN' &&
    actual !== 'UNKNOWN' &&
    titleAudience !== actual
  )
    return false;
  return (
    expected === 'UNKNOWN' ||
    actual === 'UNISEX' ||
    actual === expected ||
    actual === 'UNKNOWN'
  );
}
