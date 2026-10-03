/** Customer measurements are not product facts a merchant can teach the AI. */
export function isCustomerMeasurementGap(label: string): boolean {
  const normalized = label
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (
    /\b(urun|giysi|varyant|stok|fiyat|kumas|kalip)[a-z]*\b|\bbeden tablosu/.test(
      normalized,
    )
  ) {
    return false;
  }

  const bodyMetric = /\b(boy|kilo|gogus|bel|basen)[a-z]*\b/;
  const measurement = /\b(olcu|cevre|teyid|eslesme)[a-z]*\b/;
  if (/\b(musteri|vucut|kisisel)[a-z]*\b/.test(normalized)) {
    return bodyMetric.test(normalized) || measurement.test(normalized);
  }
  if (/\bbeden onerisi\b/.test(normalized) && bodyMetric.test(normalized)) {
    return true;
  }
  if (!bodyMetric.test(normalized)) return false;
  if (/\b(teyid|eslesme)[a-z]*\b/.test(normalized)) return true;

  const metricCount = new Set(
    [...normalized.matchAll(/\b(boy|kilo|gogus|bel|basen)[a-z]*\b/g)].map(
      (match) => match[1],
    ),
  ).size;
  return metricCount >= 2 && measurement.test(normalized);
}
