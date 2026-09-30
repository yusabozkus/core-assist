import type { AiDraftResult } from '../ai/ai-draft.types';
import {
  getSizeGuideScope,
  isSizeGuideCompatible,
  normalizeSizeText as normalize,
} from '../size-guides/size-guide-scope';
import type {
  ProductAnswerContext,
  ProductAnswerSizeGuideData,
} from './product-answer-context.types';

type Measurement = 'chest' | 'waist' | 'hip';
type MeasurementParseIssue =
  'CONFLICT' | 'RANGE' | 'UNIT' | 'PROPORTION' | 'UNREADABLE';
const names: Record<Measurement, string> = {
  chest: 'göğüs',
  waist: 'bel',
  hip: 'basen',
};
const labelPattern =
  'gogus|gogsum|gogusum|bel|belim|basen|basenim|kalca|kalcam';
const vectorLabelPattern = 'gogus|bel|basen|kalca';
const keyFor = (label: string): Measurement =>
  label.startsWith('gog') ? 'chest' : label.startsWith('bel') ? 'waist' : 'hip';
type Advice = Pick<
  AiDraftResult,
  'answer' | 'responseKind' | 'usedEvidenceIds' | 'confidence'
>;

/** Accept labelled measurements or an ordered value/label list, never unlabeled numbers. */
export function parseCustomerBodyMeasurements(question: string): {
  values: Partial<Record<Measurement, number>>;
  ambiguous: boolean;
  issue: MeasurementParseIssue | null;
} {
  const text = normalize(question);
  const values: Partial<Record<Measurement, number>> = {};
  let issue: MeasurementParseIssue | null = null;
  const put = (label: string, raw: string) => {
    const key = keyFor(label);
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < 20 || value > 250) {
      issue = 'UNREADABLE';
      return;
    }
    if (values[key] !== undefined && values[key] !== value) issue = 'CONFLICT';
    values[key] = value;
  };
  // A vector followed by its labels, e.g. "103/100/108 göğüs bel kalça".
  const vector = text.match(
    new RegExp(
      `(?:^|\\s)(\\d{2,3})\\s*(?:[/,]|\\s)\\s*(\\d{2,3})(?:\\s*(?:[/,]|\\s)\\s*(\\d{2,3}))?\\s+((?:${vectorLabelPattern})(?:\\s+(?:${vectorLabelPattern})){1,2})\\b`,
    ),
  );
  if (vector) {
    const labels = vector[4].split(/\s+/);
    const numbers = [vector[1], vector[2], vector[3]].filter(Boolean);
    if (labels.length !== numbers.length) issue = 'UNREADABLE';
    else labels.forEach((label, index) => put(label, numbers[index]));
  } else {
    // Consume each pair once so "göğüs 108 bel 100" cannot also become "108 bel".
    const pairs = new RegExp(
      `\\b(${labelPattern})\\b(?:\\s+(?:cevresi|cevrem|olcusu|olcum|olcumu))?\\s*[:=]?\\s*(\\d{2,3}(?:[.,]\\d)?)|\\b(\\d{2,3}(?:[.,]\\d)?)\\s*(?:cm\\s*)?(${labelPattern})\\b`,
      'g',
    );
    for (const match of text.matchAll(pairs))
      put(match[1] ?? match[4], match[2] ?? match[3]);
  }
  // This may be a flat garment measurement, not a body circumference. Ask, don't assume.
  if (values.waist && values.hip && values.hip < values.waist * 0.75)
    issue ??= 'PROPORTION';
  const rangePattern = new RegExp(
    `\\b(${labelPattern})\\b(?:\\s+(?:cevresi|cevrem|olcusu|olcum))?\\s*[:=]?\\s*\\d{2,3}\\s*[-–—/]\\s*\\d{2,3}|\\b\\d{2,3}\\s*[-–—/]\\s*\\d{2,3}\\s*(${labelPattern})\\b`,
  );
  const customerRange = text.match(rangePattern);
  if (customerRange) {
    delete values[keyFor(customerRange[1] ?? customerRange[2])];
    issue = 'RANGE';
  }
  if (/inch|\binc\b/.test(text)) issue = 'UNIT';
  return { values, ambiguous: issue !== null, issue };
}

function measurementKey(name: string): Measurement | null {
  const text = normalize(name);
  if (/gogus/.test(text)) return 'chest';
  if (/\bbel\b/.test(text)) return 'waist';
  if (/basen|kalca/.test(text)) return 'hip';
  return null;
}

function range(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d{2,3}(?:[.,]\d+)?)\s*(?:[-–—]\s*(\d{2,3}(?:[.,]\d+)?))?\s*(?:cm)?$/i,
    );
  if (!match) return null;
  const min = Number(match[1].replace(',', '.'));
  const max = Number((match[2] ?? match[1]).replace(',', '.'));
  return min <= max ? { min, max } : null;
}

function sizeKey(size: string) {
  return normalize(size)
    .replace(/^xxl$/, '2xl')
    .replace(/^xxxl$/, '3xl');
}

export function rowMatchesSize(label: string, size: string) {
  return label
    .split(/[\s/–—-]+/)
    .some((part) => sizeKey(part) === sizeKey(size));
}

export function isExplicitGarmentWidthQuestion(question: string) {
  return /duz zemin|koltuktan koltuga|koltuk alti|urun(?:un)? eni|urun(?:un)? genislig|en olcusu|\ben[ i]*kac|\byarim gogus|gogus eni|gogus genislig/.test(
    normalize(question),
  );
}

export function isSizeGuideAvailabilityQuestion(question: string) {
  const text = normalize(question);
  return (
    /\b(?:beden|b den) tablos?u?\b/.test(text) &&
    /\byok\b|gorunm|gorem|bulam|bulunmu|\bvar mi\b|\bmevcut mu\b|nerede|nerden|nereden/.test(
      text,
    ) &&
    !/hangi beden|kac beden|beden almali|beden oner|\b(?:cm|gsm|santim|gramaj|olcu|gogus|bel|basen|kalca|boy|kilo|kg|paca)\b|\b\d{2,3}\b/.test(
      text,
    )
  );
}

function isCarrierOnlyQuestion(question: string) {
  const text = normalize(question);
  return (
    /hangi kargo|kargo firmasi|hangi firmayla|kargoya ver|kargo ile|hangi kurye|kuryeyle|neyle gonder/.test(
      text,
    ) &&
    !/ne zaman|kac gun|sure|ucret|fiyat|bedava|ucretsiz|takip|teslim|iade|degisim|garanti|yetis|gelir/.test(
      text,
    )
  );
}

function hasNamedCarrier(value: string) {
  const namedCarrier = [
    ...value.matchAll(
      /(?<![\p{L}\p{N}])(?:\p{Lu}[\p{L}\p{N}.-]*\s+){1,2}(?:Kargo|KARGO|kargo|Kurye|kurye|Express)(?![\p{L}\p{N}])/gu,
    ),
  ].some(([name]) => {
    const words = normalize(name).split(/\s+/);
    const brand = words[words.length - 2];
    return !/^(?:anlasmali|standart|hizli|ucretsiz|ekonomik|normal|siparis)/.test(
      brand,
    );
  });
  return (
    namedCarrier ||
    /\b(?:HepsiJET|Kargoist|Scotty|FedEx|UPS|DHL|PTT|Kolay\s+Gelsin)\b/iu.test(
      value,
    )
  );
}

function verifiedCarrierAdvice(context: ProductAnswerContext): Advice | null {
  if (!isCarrierOnlyQuestion(context.question)) return null;
  const policy = context.evidence.find(
    (item) =>
      item.fact === 'SHIPPING' &&
      ['STORE_KNOWLEDGE', 'CHANNEL_OVERRIDE'].includes(item.source) &&
      item.id === 'store-shipping-policy',
  );
  if (!policy) return null;
  const carrierStatements = policy.value
    .split(/\r?\n+|(?<=[.!?;])\s+/u)
    .map((statement) => statement.trim())
    .filter(hasNamedCarrier);
  if (carrierStatements.length !== 1) return null;
  const statement = carrierStatements[0];
  if (
    statement.length > 240 ||
    /iade|degisim|garanti/.test(normalize(statement))
  )
    return null;
  return {
    answer: statement,
    responseKind: 'VERIFIED_STORE_POLICY',
    usedEvidenceIds: [policy.id],
    confidence: 0.99,
  };
}

function elastaneStretchAdvice(context: ProductAnswerContext): Advice | null {
  const question = normalize(context.question);
  if (!/esnek|esner|elastan|likra|lycra|stretch/.test(question)) return null;
  const composition = context.product.attributes.find((item) =>
    /materyal bileseni|kumas bilesimi|icerik/.test(normalize(item.name)),
  );
  if (!composition) return null;
  const match = normalize(composition.value).match(
    /(?:\b\d+(?:[,.]\d+)?\s*(?:elastan|elastane|spandeks|spandex|likra|lycra)\b)|(?:\b(?:elastan|elastane|spandeks|spandex|likra|lycra)\s*\d+(?:[,.]\d+)?\b)/,
  );
  if (!match) return null;
  const amount = match[0].match(/\d+(?:[,.]\d+)?/);
  if (!amount || Number(amount[0].replace(',', '.')) <= 0) return null;
  const evidence = context.evidence.find(
    (item) =>
      item.fact === 'MATERIAL' &&
      item.source === 'ATTRIBUTE' &&
      normalize(item.value).includes(normalize(composition.value)),
  );
  if (!evidence) return null;
  return {
    answer: `Kumaş bileşiminde %${amount[0]} elastan bulunuyor; elastan kumaşa esneklik sağlar. Esnemenin derecesi kumaş yapısına göre değişebilir.`,
    responseKind: 'MATERIAL_PROPERTY',
    usedEvidenceIds: [evidence.id],
    confidence: 0.98,
  };
}

function verifiedThicknessAdvice(context: ProductAnswerContext): Advice | null {
  const question = normalize(context.question);
  if (!/kalin|ince|gramaj|gsm/.test(question)) return null;
  const asksGsm = /gramaj|gsm/.test(question);
  const attributes = context.product.attributes.filter((item) =>
    asksGsm
      ? /gramaj|gsm/.test(normalize(item.name))
      : /kalinlik/.test(normalize(item.name)),
  );
  if (attributes.length !== 1) return null;
  const attribute = attributes[0];
  const value = normalize(attribute.value);
  if (
    asksGsm
      ? !/\d+(?:[,.]\d+)?\s*(?:gsm|g\s*\/\s*m[²2])/i.test(attribute.value)
      : !/^(?:ince|orta|kalin|orta kalinlik|orta kalin|ince kumas|kalin kumas)$/.test(
          value,
        )
  )
    return null;
  const evidence = context.evidence.find(
    (item) =>
      item.source === 'ATTRIBUTE' &&
      ((normalize(item.label) === normalize(attribute.name) &&
        normalize(item.value) === value) ||
        normalize(item.value).includes(
          normalize(`${attribute.name}: ${attribute.value}`),
        )),
  );
  if (!evidence) return null;
  return {
    answer: asksGsm
      ? `Kumaş gramajı ürün bilgilerinde ${attribute.value} olarak belirtiliyor.`
      : `Kumaş kalınlığı ürün bilgilerinde ${attribute.value} olarak belirtiliyor.`,
    responseKind: 'MATERIAL_PROPERTY',
    usedEvidenceIds: [evidence.id],
    confidence: 0.98,
  };
}

function validGuides(context: ProductAnswerContext) {
  return (context.product.sizeGuides ?? []).filter((guide) => {
    const data = guide.structuredData;
    return (
      data &&
      data.unit === 'CM' &&
      data.measurementBasis === 'BODY' &&
      Math.min(guide.confidence ?? 0, data.confidence) >= 0.9 &&
      isSizeGuideCompatible(context.product, data) &&
      context.evidence.some(
        (evidence) => evidence.id === `size-guide-${guide.id}`,
      )
    );
  });
}

function describeMeasurements(
  row: ProductAnswerSizeGuideData['rows'][number],
  keys: Measurement[],
) {
  return keys
    .flatMap((key) => {
      const item = row.measurements.find(
        (measurement) => measurementKey(measurement.name) === key,
      );
      return item && range(item.value)
        ? [`${names[key]} çevresi ${item.value} cm`]
        : [];
    })
    .join(', ');
}

/** Server-resolved guidance is intentionally narrow: it cannot clear unrelated or mixed intents. */
export function resolveProductAnswerAdvice(
  context: ProductAnswerContext,
): Advice | null {
  if (!context.requestedFacts.length) return null;
  if (
    context.requestedFacts.length === 1 &&
    context.requestedFacts[0] === 'SHIPPING'
  ) {
    return verifiedCarrierAdvice(context);
  }
  if (
    context.requestedFacts.length === 1 &&
    context.requestedFacts[0] === 'SIZE' &&
    isSizeGuideAvailabilityQuestion(context.question) &&
    context.evidence.some(
      (item) => item.id === 'product-size-guide-unavailable',
    )
  ) {
    return {
      answer: 'Bu ürünün bilgilerinde beden tablosu şu anda yer almıyor.',
      responseKind: 'CATALOG_AVAILABILITY',
      usedEvidenceIds: ['product-size-guide-unavailable'],
      confidence: 0.99,
    };
  }
  if (
    context.requestedFacts.every((fact) => ['MATERIAL', 'SIZE'].includes(fact))
  ) {
    const thicknessAdvice = verifiedThicknessAdvice(context);
    if (thicknessAdvice) return thicknessAdvice;
  }
  const question = normalize(context.question);
  if (context.requestedFacts.every((fact) => fact === 'MATERIAL')) {
    const materialAdvice = elastaneStretchAdvice(context);
    if (materialAdvice) return materialAdvice;
  }
  if (
    context.requestedFacts.every((fact) =>
      ['CARE', 'MATERIAL', 'DURABILITY'].includes(fact),
    )
  ) {
    return cottonCareAdvice(context);
  }
  if (!context.requestedFacts.every((fact) => fact === 'SIZE')) return null;
  if (/\bmanken|\bmodel|iade|kargo|fiyat|stok/.test(question)) return null;
  const customer = parseCustomerBodyMeasurements(context.question);
  const hasMeasurements = Object.keys(customer.values).length > 0;
  const customerEvidence = context.evidence.find(
    (item) => item.id === 'customer-size-input',
  );
  const clarify = (answer: string): Advice | null =>
    customerEvidence
      ? {
          answer,
          responseKind: 'CUSTOMER_CLARIFICATION',
          usedEvidenceIds: [customerEvidence.id],
          confidence: 0.99,
        }
      : null;
  if (customer.ambiguous) {
    if (customer.issue === 'RANGE')
      return clarify(
        'Ölçünüzü bir aralık olarak belirtmişsiniz. Uygun bedeni karşılaştırabilmemiz için ilgili vücut çevrenizi santimetre olarak tek bir ölçümle paylaşabilir misiniz?',
      );
    if (customer.issue === 'UNIT')
      return clarify(
        'Paylaştığınız ölçüyü beden tablosuyla karşılaştırabilmemiz için santimetre cinsinden vücut çevresi olarak belirtir misiniz?',
      );
    if (customer.issue === 'CONFLICT')
      return clarify(
        'Aynı bölge için birden fazla farklı ölçü görüyoruz. Hangi değerin vücut çevrenize ait olduğunu teyit edebilir misiniz?',
      );
    const summary = Object.entries(customer.values)
      .map(([key, value]) => `${names[key as Measurement]} ${value} cm`)
      .join(', ');
    const body =
      getSizeGuideScope(context.product).section === 'BOTTOM'
        ? 'bel ve basen'
        : 'göğüs ve bel';
    return clarify(
      `${summary ? `Ölçülerinizi ${summary} olarak anladık. ` : ''}Bunlar vücut çevresi mi, düz zeminde ölçülen ürün eni mi? Özellikle ${body} değerlerini çevre ölçüsü olarak teyit edebilir misiniz?`,
    );
  }
  const recommendation = context.heightWeightSizeRecommendation;
  if (
    !hasMeasurements &&
    recommendation &&
    ['MISSING_INPUT', 'DISABLED'].includes(recommendation.status)
  ) {
    if (recommendation.status === 'MISSING_INPUT') {
      const missing = [
        recommendation.customerHeightCm === null ? 'boy' : '',
        recommendation.customerWeightKg === null ? 'kilo' : '',
      ]
        .filter(Boolean)
        .join(' ve ');
      return clarify(
        `Beden önerisi yapabilmemiz için ${missing} bilginizi paylaşmanızı rica ederiz. Boy ve kiloya göre yapılacak öneri tahmini olacaktır.`,
      );
    }
    const body =
      getSizeGuideScope(context.product).section === 'BOTTOM'
        ? 'bel ve basen'
        : 'göğüs ve bel';
    return clarify(
      `Yalnızca boy ve kiloya göre net beden önermek yanıltıcı olabilir. Daha doğru değerlendirebilmemiz için ${body} çevre ölçülerinizi paylaşabilir misiniz?`,
    );
  }

  const guides = validGuides(context);
  if (guides.length !== 1) return null; // Conflicting tables require review, not the first match.
  const guide = guides[0];
  const data = guide.structuredData!;
  const evidenceId = `size-guide-${guide.id}`;
  const confidence = Math.min(0.99, guide.confidence ?? 0, data.confidence);
  const requestedKey = /gogus/.test(question)
    ? 'chest'
    : /\bbel\b/.test(question)
      ? 'waist'
      : /basen|kalca/.test(question)
        ? 'hip'
        : null;
  if (
    !hasMeasurements &&
    context.requestedSize &&
    requestedKey &&
    !isExplicitGarmentWidthQuestion(question)
  ) {
    const rows = data.rows.filter((row) =>
      rowMatchesSize(row.label, context.requestedSize!),
    );
    if (rows.length !== 1) return null;
    const description = describeMeasurements(rows[0], [requestedKey]);
    if (!description) return null;
    return {
      answer: `Beden tablosunda ${context.requestedSize} beden için ${description} belirtiliyor. Bu değer vücut çevresidir; ürünün düz zemindeki en ölçüsü değildir.`,
      responseKind: 'SIZE_GUIDANCE',
      usedEvidenceIds: [evidenceId],
      confidence,
    };
  }
  if (!hasMeasurements) return null;
  const primary: Measurement =
    getSizeGuideScope(context.product).section === 'BOTTOM' ? 'waist' : 'chest';
  const measurement = customer.values[primary];
  if (!measurement)
    return clarify(
      `Bu ürün için ${names[primary]} çevre ölçünüzü de paylaşabilir misiniz? Ölçüyü vücudunuzun çevresinden santimetre olarak almanız gerekir.`,
    );
  const offeredRows = data.rows.flatMap((row) => {
    const sizes = [
      ...new Set(
        context.product.variants.flatMap((variant) =>
          variant.size && rowMatchesSize(row.label, variant.size)
            ? [variant.size]
            : [],
        ),
      ),
    ];
    const cell = row.measurements.find(
      (item) => measurementKey(item.name) === primary,
    );
    const parsed = cell && range(cell.value);
    return sizes.length === 1 && parsed
      ? [{ row, size: sizes[0], ...parsed }]
      : [];
  });
  if (!offeredRows.length) return null;
  const matches = offeredRows.filter(
    (row) => measurement >= row.min && measurement <= row.max,
  );
  if (matches.length !== 1) {
    return {
      answer: `${names[primary].charAt(0).toLocaleUpperCase('tr-TR')}${names[primary].slice(1)} çevreniz ${measurement} cm; bu ölçü listelenen bedenlerin tablodaki ${names[primary]} değerleriyle tek bir bedende eşleşmiyor. Ölçüyü vücut çevresi olarak teyit edip ${primary === 'waist' ? 'basen' : 'bel'} çevrenizi de paylaşabilir misiniz?`,
      responseKind: 'CUSTOMER_CLARIFICATION',
      usedEvidenceIds: [evidenceId, 'variant-sizes'],
      confidence,
    };
  }
  const match = matches[0];
  const relevantKeys: Measurement[] =
    primary === 'waist' ? ['waist', 'hip'] : ['chest', 'waist'];
  const description = describeMeasurements(match.row, relevantKeys);
  const secondary: Measurement = primary === 'waist' ? 'hip' : 'waist';
  const secondaryValue = customer.values[secondary];
  const secondaryRange = match.row.measurements.find(
    (item) => measurementKey(item.name) === secondary,
  );
  const secondaryParsed = secondaryRange ? range(secondaryRange.value) : null;
  if (
    secondaryValue !== undefined &&
    secondaryParsed &&
    (secondaryValue < secondaryParsed.min ||
      secondaryValue > secondaryParsed.max)
  ) {
    return {
      answer: `${measurement} cm ${names[primary]} çevreniz ${match.size} bedenin ${names[primary]} aralığına giriyor, ancak ${secondaryValue} cm ${names[secondary]} çevreniz aynı bedenin ${secondaryRange!.value} cm aralığıyla eşleşmiyor. İki ölçü birlikte tek bir bedeni doğrulamadığı için beden önermek yanıltıcı olabilir. Ölçülerinizi vücut çevresi olarak yeniden kontrol edip ürünün beden tablosuyla karşılaştırabilir misiniz?`,
      responseKind: 'CUSTOMER_CLARIFICATION',
      usedEvidenceIds: [evidenceId, 'variant-sizes'],
      confidence,
    };
  }
  return {
    answer: `${measurement} cm ${names[primary]} çevreniz, tablodaki ${match.size} bedenin ${names[primary]} aralığıyla eşleşiyor. Bu beden için ${description} belirtiliyor. Diğer çevre ölçülerinizi de karşılaştırarak seçim yapmanızı öneririz; yalnızca tek ölçüyle kesin uyum garanti edilemez.`,
    responseKind: 'SIZE_GUIDANCE',
    usedEvidenceIds: [evidenceId, 'variant-sizes'],
    confidence,
  };
}

export function classifyShrinkageQuestion(question: string) {
  const text = normalize(question).replace(/[^a-z0-9]+/g, ' ');
  const mentionsWashing = /\b(?:yika\w*|yikan\w*|kurut\w*|makine\w*)\b/.test(
    text,
  );
  const asksShrinkage =
    /\b(?:cekme|ceker|cekiyor|cekmez|kucul\w*|daral\w*|kisal\w*)\b/.test(text);
  const needsWashingContext = /\b(?:cekiyor|daral\w*|kisal\w*)\b/.test(text);
  const asksWearBehavior = /\b(?:giyince|giydikce|kullandikca)\b/.test(text);
  const asksOtherProperty =
    /\b(?:solma|solar|kararma|kararir|paslan|soyul|dokul|terlet|esnek|likra|stok|fiyat|kargo|iade|beden)\w*\b/.test(
      text,
    );
  const asksExactOutcome =
    /\b(?:yuzde|oran|ne kadar|kac cm|garanti|kesin|tam olarak)\b/.test(text) ||
    /%\s*\d/.test(question);
  return {
    asksShrinkage,
    needsWashingContext,
    mentionsWashing,
    asksWearBehavior,
    asksOtherProperty,
    asksExactOutcome,
  };
}

function cottonCareAdvice(context: ProductAnswerContext): Advice | null {
  const {
    asksShrinkage,
    needsWashingContext,
    mentionsWashing,
    asksWearBehavior,
    asksOtherProperty,
    asksExactOutcome,
  } = classifyShrinkageQuestion(context.question);
  if (
    !asksShrinkage ||
    (needsWashingContext && !mentionsWashing) ||
    (asksWearBehavior && !mentionsWashing) ||
    asksOtherProperty ||
    asksExactOutcome
  )
    return null;
  if (
    context.evidence.some((item) =>
      /cekmez|cekme yapmaz|cekme (?:orani|payi)|on cekme|sanfor/.test(
        normalize(item.value),
      ),
    )
  )
    return null;
  const material = context.evidence.find(
    (item) =>
      item.fact === 'MATERIAL' &&
      /pamuk/.test(normalize(item.value)) &&
      ['ATTRIBUTE', 'TITLE', 'MERCHANT_VERIFIED'].includes(item.source),
  );
  if (!material) return null;
  // CottonWorks, Shrinking and Skewing: construction, finishing and care determine shrinkage.
  // https://cottonworks.com/learning-hub/quality-assurance/shrinking-and-skewing/
  return {
    answer:
      'Ürünümüz pamuk içeriyor. Pamuklu kumaşlarda yıkama ve kurutma koşullarına bağlı çekme görülebilir; bu ürüne özel doğrulanmış bir çekme oranı olmadığı için yüzde veremiyoruz. Çekme riskini azaltmak için ürünün bakım etiketine uymanızı ve yüksek ısıdan kaçınmanızı öneririz.',
    responseKind: 'GENERAL_CARE_GUIDANCE',
    usedEvidenceIds: [material.id],
    confidence: 0.99,
  };
}
