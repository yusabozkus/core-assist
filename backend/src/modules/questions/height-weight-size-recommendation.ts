import type {
  HeightWeightSizeRecommendation,
  ProductAnswerContext,
  ProductAnswerSizeGuideData,
} from './product-answer-context.types';

type NumericRange = { minimum: number; maximum: number };

type SizeGuideMatch = {
  guideId: string;
  size: string;
  confidence: number;
};

export function applyHeightWeightSizeRecommendation(
  context: ProductAnswerContext,
): ProductAnswerContext {
  if (!context.requestedFacts.includes('SIZE')) return context;

  const measurements = extractCustomerHeightWeight(context.question);
  if (!measurements.requested) return context;

  const enabled =
    context.responsePreferences?.heightWeightSizeRecommendationEnabled ?? false;
  if (!enabled) {
    return withRecommendation(context, {
      status: 'DISABLED',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: [],
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: null,
    });
  }

  if (measurements.heightCm === null || measurements.weightKg === null) {
    return withRecommendation(context, {
      status: 'MISSING_INPUT',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: [],
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: null,
    });
  }

  const catalogSizes = uniqueSizesByNormalized(
    context.product.variants.flatMap((variant) =>
      variant.size ? [variant.size] : [],
    ),
  );
  const canEstimate =
    !/(?:^| )(?:ayakkabi|sneaker|terlik|sandalet|cizme|bot|canta|kemer|aksesuar)(?: |$)/.test(
      normalize(`${context.product.category ?? ''} ${context.product.title}`),
    );
  const estimatedRecommendation = (candidateSizes: string[]) =>
    withRecommendation(context, {
      status: 'ESTIMATE_ALLOWED',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: candidateSizes,
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: 'variant-sizes',
    });

  const guidesWithHeightWeight =
    context.product.sizeGuides?.filter((guide) =>
      guideHasHeightWeightMapping(guide.structuredData),
    ) ?? [];
  if (guidesWithHeightWeight.length === 0) {
    if (canEstimate && catalogSizes.length >= 2) {
      return estimatedRecommendation(catalogSizes);
    }
    return withRecommendation(context, {
      status: 'GUIDE_UNAVAILABLE',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: [],
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: null,
    });
  }

  const availableSizes = new Set(
    context.product.variants.flatMap((variant) =>
      variant.size ? [normalizeSize(variant.size)] : [],
    ),
  );
  const matches = guidesWithHeightWeight
    .flatMap((guide) =>
      findGuideMatches(
        guide.id,
        guide.structuredData,
        measurements.heightCm!,
        measurements.weightKg!,
        guide.confidence,
      ),
    )
    .filter(
      (match) =>
        availableSizes.size > 0 &&
        availableSizes.has(normalizeSize(match.size)),
    );
  const uniqueSizes = unique(matches.map((match) => match.size));

  if (uniqueSizes.length === 0) {
    return withRecommendation(context, {
      status: 'NO_MATCH',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: [],
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: null,
    });
  }

  if (uniqueSizes.length > 1) {
    return withRecommendation(context, {
      status: 'AMBIGUOUS',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: uniqueSizes,
      requiredMeasurements: findRequiredBodyMeasurements(context),
      sourceEvidenceId: null,
    });
  }

  const match = matches.find((item) => item.size === uniqueSizes[0])!;
  const sourceEvidenceId = `height-weight-size-${match.guideId}`;

  return withRecommendation(
    {
      ...context,
      evidence: [
        ...context.evidence,
        {
          id: sourceEvidenceId,
          fact: 'SIZE',
          label: 'Beden tablosunda doğrulanan boy-kilo eşleşmesi',
          value: `${formatNumber(measurements.heightCm)} cm ve ${formatNumber(measurements.weightKg)} kg ölçüleri beden tablosunda doğrudan ${match.size} bedenle eşleşiyor.`,
          source: 'SIZE_GUIDE',
          confidence: match.confidence,
        },
      ],
    },
    {
      status: 'MATCHED',
      customerHeightCm: measurements.heightCm,
      customerWeightKg: measurements.weightKg,
      recommendedSizes: [match.size],
      requiredMeasurements: [],
      sourceEvidenceId,
    },
  );
}

export function parseProductAnswerSizeGuideData(
  value: unknown,
): ProductAnswerSizeGuideData | null {
  if (!isRecord(value)) return null;
  if (
    !isUnit(value.unit) ||
    !isStringArray(value.headers) ||
    !Array.isArray(value.rows) ||
    !isStringArray(value.notes) ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence)
  ) {
    return null;
  }

  const rows = value.rows.flatMap((row) => {
    if (!isRecord(row) || typeof row.label !== 'string') return [];
    if (!Array.isArray(row.measurements)) return [];

    const measurements = row.measurements.flatMap((measurement) =>
      isRecord(measurement) &&
      typeof measurement.name === 'string' &&
      typeof measurement.value === 'string'
        ? [{ name: measurement.name, value: measurement.value }]
        : [],
    );

    return measurements.length > 0 ? [{ label: row.label, measurements }] : [];
  });
  if (rows.length === 0) return null;

  return {
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(typeof value.audience === 'string' ? { audience: value.audience } : {}),
    ...(['BODY', 'GARMENT', 'MIXED', 'UNKNOWN'].includes(
      String(value.measurementBasis),
    )
      ? {
          measurementBasis: value.measurementBasis as
            'BODY' | 'GARMENT' | 'MIXED' | 'UNKNOWN',
        }
      : {}),
    unit: value.unit,
    headers: value.headers,
    rows,
    notes: value.notes,
    confidence: clampConfidence(value.confidence),
  };
}

function withRecommendation(
  context: ProductAnswerContext,
  recommendation: HeightWeightSizeRecommendation,
): ProductAnswerContext {
  return { ...context, heightWeightSizeRecommendation: recommendation };
}

function extractCustomerHeightWeight(question: string) {
  const normalized = normalize(question).replaceAll(',', '.');
  const weightMatches = [
    ...normalized.matchAll(
      /(\d{2,3}(?:\.\d+)?)\s*(?:kg|kilo(?:gram)?)(?:yum|yim|um|im|ya|ye|yla|yle)?\b/g,
    ),
  ];
  const namedWeight = normalized.match(
    /(?:kilom|kiloyum|kilo|agirligim|agirlik)\s*(?:[:=]?\s*)(\d{2,3}(?:\.\d+)?)/,
  );
  const selectedWeight = namedWeight ?? weightMatches[0];
  const weightKg = plausibleWeight(Number(selectedWeight?.[1]));

  const namedHeight = normalized.match(
    /(?:boyum|boyu|boy)\s*(?:[:=]?\s*)(\d(?:\.\d{1,2})|\d{3}(?:\.\d+)?)/,
  );
  const measuredHeight = normalized.match(
    /(\d(?:\.\d{1,2})|\d{3}(?:\.\d+)?)\s*(?:cm|santimetre|metre|boy(?:um)?)\b/,
  );
  let heightCm =
    capturedNumberOffset(namedHeight) !== capturedNumberOffset(selectedWeight)
      ? plausibleHeight(Number(namedHeight?.[1]))
      : null;
  heightCm ??= plausibleHeight(Number(measuredHeight?.[1]));

  if (heightCm === null && weightMatches[0]) {
    const beforeWeight = normalized.slice(0, weightMatches[0].index);
    const candidates = [...beforeWeight.matchAll(/\b(\d{3}|\d\.\d{1,2})\b/g)]
      .map((match) => plausibleHeight(Number(match[1])))
      .filter((value): value is number => value !== null);
    heightCm = candidates.at(-1) ?? null;
  }

  const requested =
    /\b(?:boy|boyum|kilo(?:gram)?(?:yum|yim|um|im|ya|ye|yla|yle)?|kilom|kg|agirlik|agirligim)\b/.test(
      normalized,
    );

  return { requested, heightCm, weightKg };
}

function capturedNumberOffset(match: RegExpMatchArray | null | undefined) {
  return match ? (match.index ?? 0) + match[0].lastIndexOf(match[1]) : null;
}

function guideHasHeightWeightMapping(data: ProductAnswerSizeGuideData | null) {
  return Boolean(
    data?.rows.some(
      (row) =>
        row.measurements.some((measurement) =>
          isHeightMeasurement(measurement.name),
        ) &&
        row.measurements.some((measurement) =>
          isWeightMeasurement(measurement.name),
        ),
    ),
  );
}

function findGuideMatches(
  guideId: string,
  data: ProductAnswerSizeGuideData | null,
  heightCm: number,
  weightKg: number,
  guideConfidence: number | null,
): SizeGuideMatch[] {
  if (!data) return [];

  return data.rows.flatMap((row) => {
    const heightValue = row.measurements.find((measurement) =>
      isHeightMeasurement(measurement.name),
    )?.value;
    const weightValue = row.measurements.find((measurement) =>
      isWeightMeasurement(measurement.name),
    )?.value;
    const heightRange = parseRange(heightValue, 'HEIGHT', data.unit);
    const weightRange = parseRange(weightValue, 'WEIGHT', data.unit);

    if (
      !heightRange ||
      !weightRange ||
      !contains(heightRange, heightCm) ||
      !contains(weightRange, weightKg)
    ) {
      return [];
    }

    return [
      {
        guideId,
        size: row.label.trim(),
        confidence: Math.min(
          clampConfidence(data.confidence),
          clampConfidence(guideConfidence ?? data.confidence),
        ),
      },
    ];
  });
}

function parseRange(
  rawValue: string | undefined,
  type: 'HEIGHT' | 'WEIGHT',
  unit: ProductAnswerSizeGuideData['unit'],
): NumericRange | null {
  if (!rawValue?.trim()) return null;
  const value = normalize(rawValue).replaceAll(',', '.');
  const range = value.match(
    /(\d+(?:\.\d+)?)\s*(?:cm|kg|in|inch)?\s*(?:-|–|—|\/|ile|to)\s*(\d+(?:\.\d+)?)\s*(?:cm|kg|in|inch)?/,
  );
  if (range) {
    const first = normalizeMeasurement(Number(range[1]), type, unit);
    const second = normalizeMeasurement(Number(range[2]), type, unit);
    if (first === null || second === null) return null;
    return {
      minimum: Math.min(first, second),
      maximum: Math.max(first, second),
    };
  }

  const minimum = value.match(
    /(\d+(?:\.\d+)?)\s*(?:cm|kg|in|inch)?\s*(?:\+|ve uzeri|uzeri|ustu)/,
  );
  if (minimum) {
    const parsed = normalizeMeasurement(Number(minimum[1]), type, unit);
    return parsed === null ? null : { minimum: parsed, maximum: Infinity };
  }

  const maximum = value.match(
    /(?:en fazla|en cok|alti|altinda|kadar)\s*(\d+(?:\.\d+)?)\s*(?:cm|kg|in|inch)?|(\d+(?:\.\d+)?)\s*(?:cm|kg|in|inch)?\s*(?:ve alti|alti|altinda|kadar)/,
  );
  if (maximum) {
    const parsed = normalizeMeasurement(
      Number(maximum[1] ?? maximum[2]),
      type,
      unit,
    );
    return parsed === null ? null : { minimum: -Infinity, maximum: parsed };
  }

  const exact = value.match(/\d+(?:\.\d+)?/)?.[0];
  const parsed = normalizeMeasurement(Number(exact), type, unit);
  return parsed === null ? null : { minimum: parsed, maximum: parsed };
}

function findRequiredBodyMeasurements(context: ProductAnswerContext) {
  const measurements =
    context.product.sizeGuides?.flatMap(
      (guide) =>
        guide.structuredData?.rows.flatMap((row) =>
          row.measurements.flatMap((measurement) => {
            const normalized = normalize(measurement.name);
            if (
              isNonBodyMeasurement(normalized) ||
              isHeightMeasurement(normalized) ||
              isWeightMeasurement(normalized)
            ) {
              return [];
            }
            return [measurement.name.replace(/\s*\([^)]*\)\s*/g, '').trim()];
          }),
        ) ?? [],
    ) ?? [];

  return unique(measurements).slice(0, 3);
}

function isNonBodyMeasurement(name: string) {
  return (
    /^(?:tr|eu|tr eu|uk|us|uk us|it|beden|size|numara|kanvas)(?: cm)?$/.test(
      name,
    ) || /karsiligi|uzunluk|ic bacak|ic boy|urun boyu|giysi boyu/.test(name)
  );
}

function isHeightMeasurement(name: string) {
  const normalized = normalize(name);
  if (/ic bacak|paca|urun|giysi|kol|etek|elbise|ust boy/.test(normalized)) {
    return false;
  }
  return /^(?:vucut )?boy(?:u| araligi)?(?: cm)?$|^height(?: cm)?$/.test(
    normalized,
  );
}

function isWeightMeasurement(name: string) {
  return /^(?:vucut )?(?:kilo|agirlik)(?: araligi)?(?: kg)?$|^weight(?: kg)?$|^kg$/.test(
    normalize(name),
  );
}

function plausibleHeight(value: number) {
  if (!Number.isFinite(value)) return null;
  const centimeters = value <= 2.5 ? value * 100 : value;
  return centimeters >= 100 && centimeters <= 230
    ? roundOneDecimal(centimeters)
    : null;
}

function plausibleWeight(value: number) {
  return Number.isFinite(value) && value >= 25 && value <= 300
    ? roundOneDecimal(value)
    : null;
}

function normalizeMeasurement(
  value: number,
  type: 'HEIGHT' | 'WEIGHT',
  unit: ProductAnswerSizeGuideData['unit'],
) {
  if (!Number.isFinite(value)) return null;
  if (type === 'WEIGHT') return plausibleWeight(value);

  if (unit === 'INCH') return plausibleHeight(value * 2.54);
  return plausibleHeight(value);
}

function contains(range: NumericRange, value: number) {
  return value >= range.minimum && value <= range.maximum;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,/+–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSize(value: string) {
  const normalized = normalize(value).replace(/\s+/g, '');
  const numberedExtraLarge = normalized.match(/^([2-6])xl$/);
  return numberedExtraLarge
    ? `${'x'.repeat(Number(numberedExtraLarge[1]))}l`
    : normalized;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueSizesByNormalized(values: string[]) {
  return [
    ...new Map(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => [normalizeSize(value), value]),
    ).values(),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isUnit(value: unknown): value is ProductAnswerSizeGuideData['unit'] {
  return (
    value === 'CM' ||
    value === 'INCH' ||
    value === 'MIXED' ||
    value === 'UNKNOWN'
  );
}
