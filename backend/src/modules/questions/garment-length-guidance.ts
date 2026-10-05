import type { AiDraftResult } from '../ai/ai-draft.types';
import { isSizeGuideCompatible } from '../size-guides/size-guide-scope';
import type {
  ProductAnswerContext,
  ProductAnswerEvidence,
} from './product-answer-context.types';
import {
  resolveVerifiedFitAdvice,
  rowMatchesSize,
} from './product-answer-advice';

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const lengthLabel =
  /^(?:urun(?:un)? (?:boyu|uzunlugu|uzunluk olculeri)|toplam boy|boy|boy uzunlugu|uzunluk)$/;

type Length = { size: string | null; cm: number; evidenceId: string };

export function isGarmentLengthQuestion(question: string) {
  const text = normalize(question);
  return (
    /\b(?:boyu|uzunlugu|uzunluk|toplam boy)\b/.test(text) &&
    !/\b(?:manken|boyum|boyunda|boyunuz|boyunu|kol|paca|ic bacak|ic boy)\b/.test(
      text,
    ) &&
    !/cekme|kisalir|yika|kurut/.test(text)
  );
}

export function isRelativeGarmentLengthQuestion(question: string) {
  return (
    isGarmentLengthQuestion(question) &&
    /\b(?:gore|normal|standart|regular|kisa\w*|uzun\w*|crop|karsilastir\w*)\b/.test(
      normalize(question),
    )
  );
}

function catalogLengths(
  product: ProductAnswerContext['product'],
): Omit<Length, 'evidenceId'>[] {
  const result: Omit<Length, 'evidenceId'>[] = [];
  for (const attribute of product.attributes) {
    if (!lengthLabel.test(normalize(attribute.name))) continue;
    const value = attribute.value.match(
      /^\s*(\d+(?:[,.]\d+)?)\s*(?:cm|santim(?:etre)?)\s*$/i,
    );
    if (value)
      result.push({ size: null, cm: Number(value[1].replace(',', '.')) });
  }
  // Restrict extraction to a named garment-length section. Model height,
  // chest circumference and sleeve length in nearby prose are different facts.
  for (const match of (product.description ?? '').matchAll(
    /(?:Ürün\s+(?:Uzunluk\s+Ölçüleri|Boy\s+Ölçüleri|Uzunluğu|Boyu)|Toplam\s+Boy)\s*:\s*([^\n;]+)/giu,
  )) {
    const section = match[1].split(
      /(?<![\p{L}\p{N}])(?:Manken|Model|Kol|Paça|Göğüs|Bel|Basen|Kalça|Yaka|Ürün\s+Eni|Ürün\s+Genişliği)(?![\p{L}\p{N}])[^:]{0,30}:/iu,
    )[0];
    const sized = [
      ...section.matchAll(
        /\b(\d?X{1,3}L|XS|S|M|L|[2-6]XL|\d{2,3})\s*[-:–]\s*(\d+(?:[,.]\d+)?)\s*(?:cm|santim(?:etre)?)/giu,
      ),
    ];
    for (const cell of sized)
      result.push({
        size: cell[1].toUpperCase(),
        cm: Number(cell[2].replace(',', '.')),
      });
    if (!sized.length) {
      const value = section.match(
        /^\s*(\d+(?:[,.]\d+)?)\s*(?:cm|santim(?:etre)?)\s*$/i,
      );
      if (value)
        result.push({ size: null, cm: Number(value[1].replace(',', '.')) });
    }
  }
  return result.filter(
    (item) => Number.isFinite(item.cm) && item.cm >= 5 && item.cm <= 250,
  );
}

export function garmentLengthEvidence(
  product: ProductAnswerContext['product'],
): ProductAnswerEvidence | null {
  const lengths = catalogLengths(product);
  if (!lengths.length) return null;
  return {
    id: 'catalog-garment-lengths',
    fact: 'SIZE',
    label: 'Katalogdaki ürün boy ölçüleri',
    value: lengths
      .map(
        (item) =>
          `${item.size ? `${item.size}: ` : ''}${item.cm.toLocaleString('tr-TR')} cm`,
      )
      .join('; '),
    source: 'DESCRIPTION',
    confidence: 1,
  };
}

function verifiedLengths(context: ProductAnswerContext): Length[] {
  const result: Length[] = context.evidence.some(
    (item) => item.id === 'catalog-garment-lengths',
  )
    ? catalogLengths(context.product).map((item) => ({
        ...item,
        evidenceId: 'catalog-garment-lengths',
      }))
    : [];
  for (const guide of context.product.sizeGuides ?? []) {
    const data = guide.structuredData;
    if (
      data?.measurementBasis !== 'GARMENT' ||
      data.unit !== 'CM' ||
      (guide.confidence ?? 0) < 0.95 ||
      data.confidence < 0.95 ||
      !isSizeGuideCompatible(context.product, data) ||
      !context.evidence.some((item) => item.id === `size-guide-${guide.id}`)
    )
      continue;
    for (const row of data.rows) {
      for (const cell of row.measurements) {
        if (!lengthLabel.test(normalize(cell.name).replace(/ cm$/, '')))
          continue;
        if (!/^\d+(?:[,.]\d+)?(?:\s*cm)?$/i.test(cell.value.trim())) continue;
        const cm = Number(cell.value.replace(/\s*cm/i, '').replace(',', '.'));
        if (cm >= 5 && cm <= 250)
          result.push({
            size: row.label,
            cm,
            evidenceId: `size-guide-${guide.id}`,
          });
      }
    }
  }
  return result;
}

export function resolveGarmentLengthGuidance(
  context: ProductAnswerContext,
): Pick<
  AiDraftResult,
  'answer' | 'responseKind' | 'usedEvidenceIds' | 'confidence'
> | null {
  if (
    !isGarmentLengthQuestion(context.question) ||
    !context.requestedFacts.includes('SIZE') ||
    !context.requestedFacts.every((fact) => ['SIZE', 'FIT'].includes(fact))
  )
    return null;
  // A length question does not settle a second width/size recommendation.
  if (
    /en olc|\beni\b|genislik|gogus|bel|basen|kac beden|hangi beden|kilo|\bkg\b/.test(
      normalize(context.question),
    )
  )
    return null;
  if (
    context.requestedSize &&
    !context.product.variants.some(
      (variant) =>
        variant.size && rowMatchesSize(variant.size, context.requestedSize!),
    )
  )
    return null;
  const lengths = verifiedLengths(context).filter(
    (item) =>
      item.size === null ||
      context.product.variants.some(
        (variant) => variant.size && rowMatchesSize(item.size!, variant.size),
      ),
  );
  const selected = context.requestedSize
    ? lengths.filter(
        (item) =>
          item.size === null ||
          rowMatchesSize(item.size, context.requestedSize!),
      )
    : lengths;
  if (
    !selected.length ||
    (context.requestedSize &&
      selected.some((item) => item.cm !== selected[0].cm))
  )
    return null;
  const sameSize = (left: string | null, right: string | null) =>
    left === null || right === null || rowMatchesSize(left, right);
  if (
    selected.some((item) =>
      selected.some(
        (other) => sameSize(item.size, other.size) && item.cm !== other.cm,
      ),
    )
  )
    return null;
  const unique = selected.filter(
    (item, index) =>
      selected.findIndex(
        (other) => sameSize(item.size, other.size) && item.cm === other.cm,
      ) === index,
  );
  const values = unique
    .map(
      (item) =>
        `${item.size ? `${item.size} beden ` : ''}${item.cm.toLocaleString('tr-TR')} cm`,
    )
    .join(', ');
  const relative = isRelativeGarmentLengthQuestion(context.question);
  const fit = context.requestedFacts.includes('FIT')
    ? resolveVerifiedFitAdvice(context)
    : null;
  if (context.requestedFacts.includes('FIT') && !fit) return null;
  return {
    answer: `${fit ? `${fit.answer} ` : ''}${
      relative
        ? `Kalıp adı tek başına ürünün normal kesim bir üründen daha uzun veya kısa olduğunu göstermez. Katalogdaki ürün boyları: ${values}. Kullandığınız benzer bir ürünün boyunu aynı ölçüm yöntemiyle bu değerlerle karşılaştırabilirsiniz.`
        : `Katalogda ürün boyu ${values} olarak belirtiliyor.`
    }`,
    responseKind: 'SIZE_GUIDANCE',
    usedEvidenceIds: [
      ...new Set([
        ...unique.map((item) => item.evidenceId),
        ...(fit?.usedEvidenceIds ?? []),
      ]),
    ],
    confidence: Math.min(
      0.99,
      fit?.confidence ?? 1,
      ...unique.map((item) => {
        if (!item.evidenceId.startsWith('size-guide-')) return 1;
        const guide = context.product.sizeGuides?.find(
          (guide) => `size-guide-${guide.id}` === item.evidenceId,
        );
        return Math.min(
          guide?.confidence ?? 0,
          guide?.structuredData?.confidence ?? 0,
        );
      }),
    ),
  };
}

export function missingGarmentLengthInformation(context: ProductAnswerContext) {
  if (!isGarmentLengthQuestion(context.question)) return null;
  const selected = verifiedLengths(context).filter(
    (item) =>
      !context.requestedSize ||
      item.size === null ||
      rowMatchesSize(item.size, context.requestedSize),
  );
  if (
    selected.some((item) =>
      selected.some(
        (other) =>
          (item.size === null ||
            other.size === null ||
            rowMatchesSize(item.size, other.size)) &&
          item.cm !== other.cm,
      ),
    )
  )
    return 'Ürünün çelişen boy ölçülerinin doğrulanması';
  return !selected.length && isRelativeGarmentLengthQuestion(context.question)
    ? 'Ürünün doğrulanmış boy ölçüsü veya karşılaştırmalı boy bilgisi'
    : null;
}

export function hasUnsupportedGarmentLengthClaim(
  answer: string,
  context: ProductAnswerContext,
) {
  const lengths = verifiedLengths(context);
  for (const sentence of answer.split(
    /[.!?;]+|,\s+(?!\d)|\b(?:ama|ancak)\b/u,
  )) {
    const text = normalize(sentence);
    if (
      /anlamina gelme|gosterme|garanti etme|belirtilmem|bulunmuyor|yer almiyor|soyleyem|teyit edem/.test(
        text,
      )
    )
      continue;
    if (
      /(?:boy|uzunluk).*(?:beden|tablo|secenek).*(?:yer al|belirtil|listelen|bulun|gosteril)/.test(
        text,
      ) &&
      !lengths.length
    )
      return true;
    if (
      /oversize|normal kesim|standart kesim|regular/.test(text) &&
      /daha uzun|daha kisa|uzun (?:bir )?durus|kisa (?:bir )?durus/.test(text)
    ) {
      const supported = context.evidence
        .filter((item) => item.source !== 'CUSTOMER_INPUT')
        .some((item) =>
          /(?:normal|standart|regular).*(?:gore|kiyas).*(?:uzun|kisa)/.test(
            normalize(item.value),
          ),
        );
      if (!supported) return true;
    }
  }
  if (isGarmentLengthQuestion(context.question)) {
    const selected = lengths.filter(
      (item) =>
        !context.requestedSize ||
        item.size === null ||
        rowMatchesSize(item.size, context.requestedSize),
    );
    const claimed = [
      ...answer.matchAll(/\b(\d+(?:[,.]\d+)?)\s*(?:cm|santim(?:etre)?)\b/giu),
    ];
    if (
      claimed.length &&
      context.requestedSize &&
      !context.product.variants.some(
        (variant) =>
          variant.size && rowMatchesSize(variant.size, context.requestedSize!),
      )
    )
      return true;
    if (
      claimed.some(
        (match) =>
          !selected.some(
            (item) => item.cm === Number(match[1].replace(',', '.')),
          ),
      )
    )
      return true;
  }
  return false;
}
