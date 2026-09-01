import type { NormalizedSizeGuide } from './catalog-connector';

const HEPSIBURADA_SIZE_GUIDE_URL = 'https://www.hepsiburada.com/beden-tablosu';

type GuideRow = {
  label: string;
  measurements: Array<{ name: string; value: string }>;
};

const CLOTHING_ROWS: GuideRow[] = [
  clothingRow('XS', '38', '28', '44', '86-91', '37'),
  clothingRow('S', '40', '30', '46', '91-96', '38'),
  clothingRow('M', '42', '32', '48', '96-101', '41'),
  clothingRow('L', '44', '34', '50', '101-106', '43'),
  clothingRow('XL', '46', '36', '52', '106-111', '44'),
  clothingRow('XXL', '48', '38', '54', '111-116', '46'),
  clothingRow('XXXL', '50', '40', '56', '116-121', '48'),
];

const JEAN_ROWS: GuideRow[] = [
  jeanRow('W28', '38', '68-70', 'L30', '69-74'),
  jeanRow('W29', '39', '70-73', 'L32', '74-79'),
  jeanRow('W30', '40', '73-75', 'L34', '79-84'),
  jeanRow('W31', '41', '75-78', 'L36', '84-89'),
  jeanRow('W32', '42', '78-80'),
  jeanRow('W33', '43', '80-83'),
  jeanRow('W34', '44', '83-86'),
  jeanRow('W36', '46', '86-91'),
  jeanRow('W38', '48', '91-96'),
  jeanRow('W40', '50', '96-101'),
];

export function createHepsiburadaMenSizeGuide(
  category: string,
): NormalizedSizeGuide {
  const isBottom = /pantolon|jean/i.test(category);
  const title = isBottom
    ? 'Hepsiburada Erkek Jean Beden Tablosu'
    : 'Hepsiburada Erkek Giyim Beden Tablosu';
  const headers = isBottom
    ? ['Kanvas', 'Bel (cm)', 'Uzunluk', 'İç Bacak Boyu (cm)']
    : ['TR/EU', 'UK/US', 'IT', 'Göğüs (cm)', 'Yaka (cm)'];
  const rows = isBottom ? JEAN_ROWS : CLOTHING_ROWS;
  const notes = isBottom
    ? [
        'W değeri bel ölçüsünü, L değeri iç bacak boyunu ifade eder.',
        'Bel çevresi kalça kemiğinin üstündeki bölgeden ölçülmelidir.',
        'Bu tablo Hepsiburada erkek jean genel beden rehberidir; ürün kalıbı ve kumaş esnekliği ayrıca dikkate alınmalıdır.',
      ]
    : [
        'Göğüs çevresi, mezura yere paralel olacak şekilde göğsün en geniş yerinden ölçülmelidir.',
        'Bu tablo Hepsiburada erkek giyim genel beden rehberidir; ürün kalıbı ve kumaş esnekliği ayrıca dikkate alınmalıdır.',
      ];

  return {
    sourceUrl: HEPSIBURADA_SIZE_GUIDE_URL,
    rawText: formatRawText(title, headers, rows, notes),
    structuredData: {
      title,
      unit: 'CM',
      headers,
      rows,
      notes,
      confidence: 1,
    },
  };
}

function clothingRow(
  label: string,
  trEu: string,
  ukUs: string,
  it: string,
  chest: string,
  collar: string,
): GuideRow {
  return {
    label,
    measurements: [
      { name: 'TR/EU', value: trEu },
      { name: 'UK/US', value: ukUs },
      { name: 'IT', value: it },
      { name: 'Göğüs (cm)', value: chest },
      { name: 'Yaka (cm)', value: collar },
    ],
  };
}

function jeanRow(
  label: string,
  canvas: string,
  waist: string,
  length?: string,
  inseam?: string,
): GuideRow {
  return {
    label,
    measurements: [
      { name: 'Kanvas', value: canvas },
      { name: 'Bel (cm)', value: waist },
      ...(length ? [{ name: 'Uzunluk', value: length }] : []),
      ...(inseam ? [{ name: 'İç Bacak Boyu (cm)', value: inseam }] : []),
    ],
  };
}

function formatRawText(
  title: string,
  headers: string[],
  rows: GuideRow[],
  notes: string[],
) {
  return [
    title,
    ['Beden', ...headers].join(' | '),
    ...rows.map((row) =>
      [
        row.label,
        ...headers.map(
          (header) =>
            row.measurements.find((measurement) => measurement.name === header)
              ?.value ?? '-',
        ),
      ].join(' | '),
    ),
    ...notes,
  ].join('\n');
}
