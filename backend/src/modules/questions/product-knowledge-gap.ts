import { ProductKnowledgeFactType } from '../../generated/prisma/enums';
import type { ProductAnswerFact } from './product-answer-context.types';
import { isCustomerMeasurementGap } from './customer-measurement-gap';

export type ProductKnowledgeGap = {
  key: string;
  label: string;
  factType: ProductKnowledgeFactType;
};

const LEARNABLE_FACTS = new Set<ProductAnswerFact>([
  'MATERIAL',
  'DURABILITY',
  'SIZE',
  'COLOR',
  'FIT',
  'CARE',
  'PRODUCT_INFO',
]);

const DYNAMIC_OR_POLICY_PATTERN =
  /\b(stok|fiyat|kampanya|indirim|teslimat tarihi|kargo suresi|iade suresi|degisim suresi)\b/;

export function extractProductKnowledgeGaps(input: {
  question: string;
  missingInformation: unknown;
  requestedFacts?: unknown;
  detectedFacts?: unknown;
}): ProductKnowledgeGap[] {
  const missingItems = stringArray(input.missingInformation);
  const requestedFacts = factArray(input.requestedFacts);
  const detectedFacts = factArray(input.detectedFacts);
  const seen = new Set<string>();

  return missingItems.flatMap((item) => {
    const label = cleanLabel(item);
    if (!label) return [];
    if (isCustomerMeasurementGap(label)) return [];

    const normalized = normalizeKnowledgeText(`${label} ${input.question}`);
    if (DYNAMIC_OR_POLICY_PATTERN.test(normalized)) return [];

    const factType = inferFactType(normalized, [
      ...requestedFacts,
      ...detectedFacts,
    ]);
    if (!factType) return [];

    const key = canonicalKnowledgeKey(normalized, factType, label);
    if (seen.has(key)) return [];
    seen.add(key);

    return [{ key, label, factType }];
  });
}

export function normalizeKnowledgeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function questionMatchesKnowledgeVariant(
  question: string,
  variant: { size: string | null; color: string | null; sku?: string | null },
) {
  const normalizedQuestion = ` ${normalizeKnowledgeText(question)} `;
  const candidates = [variant.size, variant.color, variant.sku]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeKnowledgeText)
    .filter((value) => value.length > 0);

  return candidates.some((value) => normalizedQuestion.includes(` ${value} `));
}

export function isUnusualKnowledgeMeasurement(key: string, value: string) {
  if (!key.includes('LENGTH') && !key.includes('MEASUREMENT')) return false;

  const match = normalizeKnowledgeText(value).match(
    /\b(\d+(?:[.,]\d+)?)\s*cm\b/,
  );
  if (!match) return false;

  const amount = Number(match[1].replace(',', '.'));
  return Number.isFinite(amount) && (amount <= 0 || amount > 250);
}

function inferFactType(
  normalized: string,
  requestedFacts: ProductAnswerFact[],
): ProductKnowledgeFactType | null {
  if (/\b(yikama|bakim|utule|kurut|cekme)\b/.test(normalized)) {
    return ProductKnowledgeFactType.CARE;
  }
  if (
    /\b(bacak|paca|beden|olcu|uzunluk|boyu|gogus|bel|en|cm)\b/.test(normalized)
  ) {
    return ProductKnowledgeFactType.SIZE;
  }
  if (/\b(materyal|malzeme|kumas|pamuk|polyester|icerik)\b/.test(normalized)) {
    return ProductKnowledgeFactType.MATERIAL;
  }
  if (/\b(dayanik|solma|kararma|paslan|su gecir|soyul)\b/.test(normalized)) {
    return ProductKnowledgeFactType.DURABILITY;
  }
  if (/\b(kalip|kesim|dar|bol|oversize|regular|slim)\b/.test(normalized)) {
    return ProductKnowledgeFactType.FIT;
  }
  if (/\b(renk|tonu)\b/.test(normalized)) {
    return ProductKnowledgeFactType.COLOR;
  }

  const requested = requestedFacts.find((fact) => LEARNABLE_FACTS.has(fact));
  return requested
    ? toKnowledgeFactType(requested)
    : ProductKnowledgeFactType.PRODUCT_INFO;
}

function canonicalKnowledgeKey(
  normalized: string,
  factType: ProductKnowledgeFactType,
  label: string,
) {
  if (
    /\b(ic bacak|bacak boy|bacak uzun|paca boy|paca uzun)\b/.test(normalized)
  ) {
    return 'INSEAM_LENGTH';
  }
  if (/\b(kol boy|kol uzun)\b/.test(normalized)) return 'SLEEVE_LENGTH';
  if (/\b(urun boy|urun uzun|toplam uzun)\b/.test(normalized)) {
    return 'PRODUCT_LENGTH';
  }
  if (/\b(gogus)\b/.test(normalized)) return 'CHEST_MEASUREMENT';
  if (/\b(bel)\b/.test(normalized)) return 'WAIST_MEASUREMENT';
  if (/\b(ic goster|seffaf|transparan)\b/.test(normalized)) {
    return 'TRANSPARENCY';
  }
  if (/\b(yikama|bakim|utule|kurut)\b/.test(normalized)) {
    return 'CARE_INSTRUCTIONS';
  }
  if (/\b(paket|kutu|kutu icer|paket icer|kac adet)\b/.test(normalized)) {
    return 'PACKAGE_CONTENT';
  }
  if (/\b(materyal|malzeme|kumas|icerik)\b/.test(normalized)) {
    return 'MATERIAL_DETAILS';
  }
  if (/\b(kalip|kesim)\b/.test(normalized)) return 'FIT_DETAILS';

  const slug = normalizeKnowledgeText(label)
    .split(' ')
    .filter(
      (token) =>
        !['icin', 'ilgili', 'bilgi', 'durumu', 'nedir'].includes(token),
    )
    .slice(0, 10)
    .join('_')
    .toLocaleUpperCase('en-US')
    .slice(0, 80);
  return slug || `${factType}_DETAIL`;
}

function toKnowledgeFactType(fact: ProductAnswerFact) {
  switch (fact) {
    case 'MATERIAL':
      return ProductKnowledgeFactType.MATERIAL;
    case 'DURABILITY':
      return ProductKnowledgeFactType.DURABILITY;
    case 'SIZE':
      return ProductKnowledgeFactType.SIZE;
    case 'COLOR':
      return ProductKnowledgeFactType.COLOR;
    case 'FIT':
      return ProductKnowledgeFactType.FIT;
    case 'CARE':
      return ProductKnowledgeFactType.CARE;
    default:
      return ProductKnowledgeFactType.PRODUCT_INFO;
  }
}

function cleanLabel(value: string) {
  return value
    .replace(/^eksik bilgi\s*:\s*/i, '')
    .replace(/[.?!,:;\s]+$/g, '')
    .trim()
    .slice(0, 180);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function factArray(value: unknown): ProductAnswerFact[] {
  return stringArray(value).filter((item): item is ProductAnswerFact =>
    [
      'STOCK',
      'PRICE',
      'MATERIAL',
      'DURABILITY',
      'SHIPPING',
      'RETURN',
      'EXCHANGE',
      'WARRANTY',
      'SIZE',
      'COLOR',
      'FIT',
      'CARE',
      'PRODUCT_CODE',
      'PRODUCT_INFO',
    ].includes(item),
  );
}
