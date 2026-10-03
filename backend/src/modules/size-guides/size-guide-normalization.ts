import type { GeminiSizeGuideExtraction } from '../ai/gemini-client.types';
import { normalizeSizeText } from './size-guide-scope';

/** A side-by-side inseam chart is sometimes merged into the first few waist rows by OCR. */
export function separateIndependentLengthTable(
  input: GeminiSizeGuideExtraction,
): GeminiSizeGuideExtraction {
  const inside = (name: string) =>
    /^ic boy(?: cm)?$/.test(normalizeSizeText(name));
  const length = (name: string) =>
    /^boy(?: cm)?$/.test(normalizeSizeText(name));
  const pairs = input.rows.map((row) => ({
    inside:
      row.measurements.find((item) => inside(item.name))?.value.trim() ?? '',
    length:
      row.measurements.find((item) => length(item.name))?.value.trim() ?? '',
  }));
  const filled = pairs.filter((pair) => pair.inside && pair.length);
  const isSeparate =
    /alt giyim/.test(normalizeSizeText(input.title)) &&
    filled.length >= 2 &&
    filled.length < input.rows.length / 2 &&
    pairs.slice(0, filled.length).every((pair) => pair.inside && pair.length) &&
    pairs.slice(filled.length).every((pair) => !pair.inside && !pair.length) &&
    filled.every(
      (pair) =>
        /^\d{2}$/.test(pair.inside) &&
        /^\d{2,3}(?:[.,]\d+)?$/.test(pair.length),
    );
  if (!isSeparate) return input;
  const rows = input.rows.map((row) => ({
    ...row,
    measurements: row.measurements.filter(
      (item) => !inside(item.name) && !length(item.name) && item.value.trim(),
    ),
  }));
  const notes = [
    ...input.notes.filter(
      (note) => !/ic boy|boy deger/.test(normalizeSizeText(note)),
    ),
    `Bağımsız iç boy tablosu: ${filled.map((pair) => `${pair.inside} = ${pair.length} cm`).join('; ')}. Bu uzunluklar bel bedenleriyle satır satır eşleşmez.`,
  ];
  const headers = input.headers.filter(
    (header) => !inside(header) && !length(header),
  );
  const rawText = [
    input.title,
    ...rows.map(
      (row) =>
        `${row.label}: ${row.measurements.map((item) => `${item.name} ${item.value}`).join(', ')}`,
    ),
    ...notes.map((note) => `Not: ${note}`),
  ].join('\n');
  return { ...input, headers, rows, notes, rawText };
}
