/** Distinguishes wearing a garment in certain weather from washing it at that temperature. */
export function isAmbientWearQuestion(question: string): boolean {
  const normalized = question
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const asksAboutWearing = /\b(?:giy\w*|kullan\w*|terlet\w*)\b/.test(
    normalized,
  );
  const mentionsWeather =
    /\b(?:derece\w*|sicaklik\w*|hava\w*|yaz\w*|kis\w*|mevsim\w*)\b/.test(
      normalized,
    ) || /\b\d{1,2}\s*c\b/.test(normalized);
  const asksAboutWashing = /\b(?:yika\w*|yikan\w*|kurut\w*)\b/.test(normalized);

  return asksAboutWearing && mentionsWeather && !asksAboutWashing;
}
