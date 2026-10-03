import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type {
  MockProductSeed,
  MockProductVariantSeed,
} from '../modules/channels/providers/mock-catalog.connector';

const PRODUCT_LIMIT = 30;
const CAPTURED_AT = new Date().toISOString().slice(0, 10);
const CACHE_DIRECTORY = resolve(tmpdir(), 'core-assist-marketplace-fixtures');
const BANNED_PRODUCT_PATTERN = /boxer|çorap|corap/i;
const TRENDYOL_CATEGORY_URL =
  'https://www.trendyol.com/defacto-erkek-giyim-x-b37-g2-c82';
const HEPSIBURADA_CATEGORY_URLS = [
  'https://www.hepsiburada.com/defacto-erkek-t-shirt-xc-12087279-b362',
  'https://www.hepsiburada.com/defacto-erkek-gomlekleri-xc-12087280-b362',
  'https://www.hepsiburada.com/defacto-erkek-pantolonlar-xc-12087282-b362',
  'https://www.hepsiburada.com/defacto-erkek-montlar-xc-60000759-b362',
  'https://www.hepsiburada.com/defacto-erkek-ceketler-xc-12087283-b362',
  'https://www.hepsiburada.com/defacto-erkek-sweatshirt-xc-60006835-b362',
  'https://www.hepsiburada.com/defacto-erkek-kazak-xc-12087281-b362',
] as const;

// Marketplace attributes can lag behind the seller's own product content.
// Keep narrowly scoped, source-verified corrections here so a refresh cannot
// overwrite known-good facts with stale marketplace metadata.
const TRENDYOL_VERIFIED_PRODUCT_CONTENT: Record<
  string,
  { description: string }
> = {
  F3269AX25AU: {
    description:
      'Jogger fit kesimi ve pamuklu kumaşıyla rahatlık sunan pantolon, spor ve günlük kombinlerde şıklığı bir arada sağlar. Beli lastikli tasarımı hareket özgürlüğünü destekler.\nPamuk 88%,Elastan 2%,Poliester 10%\nManken Bilgileri Lacivert-NV86: Göğüs: 93 Boy: 1,85 Basen: 97 Bel: 87\nManken Bedeni Lacivert-NV86: 32\nÜrün Kodu: F3269AX25AU\nManken Bilgileri Haki-KH475: Göğüs: 93 Boy: 1,85 Basen: 97 Bel: 87\nManken Bedeni Haki-KH475: 32',
  },
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function fetchWithCurl(url: string): string {
  return execFileSync(
    'curl.exe',
    [
      '-sS',
      '-L',
      '--fail',
      '--max-time',
      '60',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      '-H',
      'accept-language: tr-TR,tr;q=0.9',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
}

async function fetchMarkdown(url: string, attempt = 1): Promise<string> {
  mkdirSync(CACHE_DIRECTORY, { recursive: true });
  const cacheKey = Buffer.from(url).toString('base64url');
  const cachePath = resolve(CACHE_DIRECTORY, `${cacheKey}.md`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');

  const response = await fetch(`https://r.jina.ai/http://${url}`);
  if (response.ok) {
    const markdown = await response.text();
    writeFileSync(cachePath, markdown, 'utf8');
    return markdown;
  }
  if (attempt >= 5) {
    throw new Error(`${url} alınamadı (${response.status}).`);
  }
  await new Promise((resolvePromise) =>
    setTimeout(
      resolvePromise,
      response.status === 429 ? 15_000 * attempt : 2_000 * attempt,
    ),
  );
  return fetchMarkdown(url, attempt + 1);
}

function parseJsonAssignment(html: string, name: string): unknown {
  const marker = `window["${name}"]=`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`${name} bulunamadı.`);

  const valueStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = valueStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(html.slice(valueStart, index + 1)) as unknown;
      }
    }
  }
  throw new Error(`${name} tamamlanmamış JSON içeriyor.`);
}

function attributeValue(
  attributes: Array<{ name: string; value: string }>,
  names: string[],
): string | undefined {
  return attributes.find((attribute) =>
    names.some((name) => attribute.name.toLocaleLowerCase('tr-TR') === name),
  )?.value;
}

function trendyolDescription(markdown: string): string {
  const start = markdown.indexOf('## Ürün Açıklaması');
  if (start < 0) return '';

  const possibleEnds = [
    markdown.indexOf('### Ek Bilgiler', start),
    markdown.indexOf('### DeFacto ', start),
    markdown.indexOf('## Ürün Değerlendirmeleri', start),
  ].filter((index) => index > start);
  const end = possibleEnds.length ? Math.min(...possibleEnds) : markdown.length;

  return markdownPlainText(markdown.slice(start, end))
    .replace(/^Ürün Açıklaması\s*/i, '')
    .trim();
}

function materialCompositionFromDescription(description: string) {
  const normalized = description.replace(/\s+/g, ' ');
  const composition = normalized.match(
    /(?:(?:pamuk|cotton|polyester|poliester|elastan|viskoz|poliamid)\s*%?\s*\d{1,3}\s*%?\s*[,;]?\s*){2,}/i,
  )?.[0];

  return composition?.trim().replace(/[,;\s]+$/, '') || null;
}

function preferDescriptionFacts(
  attributes: Array<{ name: string; value: string }>,
  description: string,
) {
  const materialComposition = materialCompositionFromDescription(description);
  if (!materialComposition) return attributes;

  return attributes.map((attribute) =>
    attribute.name.toLocaleLowerCase('tr-TR') === 'materyal bileşeni'
      ? { ...attribute, value: materialComposition }
      : attribute,
  );
}

function trendyolProductFromUrl(
  url: string,
  markdown: string,
  index: number,
): MockProductSeed {
  const html = fetchWithCurl(url);
  const props = asRecord(parseJsonAssignment(html, '__envoy__SHARED_PROPS'));
  const product = asRecord(props.product);
  const merchantListing = asRecord(product.merchantListing);
  const merchant = asRecord(merchantListing.merchant);
  const winnerVariant = asRecord(merchantListing.winnerVariant);
  const winnerPrice = asRecord(winnerVariant.price);
  const discountedPrice = asRecord(winnerPrice.discountedPrice);
  const productId = asNumber(product.id);
  const title = asString(product.name);
  const code = asString(product.productCode);
  const gender = asString(asRecord(product.gender).name);

  if (!productId || !title || !code)
    throw new Error(`${url} eksik ürün verisi.`);
  if (gender !== 'Erkek' || BANNED_PRODUCT_PATTERN.test(title)) {
    throw new Error(`${url} erkek dışı veya yasaklı kategoride.`);
  }

  const rawAttributes = asRecords(product.attributes).flatMap((attribute) => {
    const name = asString(asRecord(attribute.key).name);
    const value = asString(asRecord(attribute.value).name);
    const description = asString(attribute.description);
    if (!name || !value) return [];
    return [{ name, value: description ? `${value} — ${description}` : value }];
  });
  const description =
    TRENDYOL_VERIFIED_PRODUCT_CONTENT[code]?.description ??
    trendyolDescription(markdown);
  const attributes = preferDescriptionFacts(rawAttributes, description);
  if (!attributes.some((attribute) => attribute.name === 'Cinsiyet')) {
    attributes.unshift({ name: 'Cinsiyet', value: gender });
  }

  const images = unique(
    (Array.isArray(product.images) ? product.images : [])
      .map(asString)
      .filter((image) => image.startsWith('https://cdn.dsmcdn.com/')),
  );
  const color =
    attributeValue(attributes, ['renk']) ??
    asString(asRecord(product.slicingAttributes).DsmColor) ??
    'Belirtilmemiş';
  const productVariants = asRecords(product.variants);
  const winnerQuantity = asNumber(winnerVariant.quantity);
  const variants: MockProductVariantSeed[] = productVariants.map(
    (variant, variantIndex) => {
      const price = asNumber(asRecord(variant.price).value);
      const value = asString(variant.value);
      const itemNumber =
        asString(variant.itemNumber) ||
        (typeof variant.itemNumber === 'number'
          ? String(variant.itemNumber)
          : `${productId}-${variantIndex}`);
      return {
        externalId: itemNumber,
        sku: `${code}-${value || variantIndex + 1}`,
        barcode: asString(variant.barcode) || null,
        color,
        size: value || null,
        price:
          price ??
          asNumber(discountedPrice.value) ??
          asNumber(winnerPrice.value) ??
          0,
        stock:
          variant.itemNumber === winnerVariant.itemNumber &&
          winnerQuantity !== undefined
            ? winnerQuantity
            : variant.inStock === true
              ? 1
              : 0,
      };
    },
  );
  const price =
    asNumber(discountedPrice.value) ??
    variants[0]?.price ??
    asNumber(winnerPrice.value) ??
    0;

  return {
    id: 1001 + index,
    code,
    title,
    // Never synthesize a description from attributes. An empty description is
    // safer than presenting generated text as marketplace copy.
    description,
    brand: asString(asRecord(product.brand).name) || 'DeFacto',
    category: asString(asRecord(product.category).name) || 'Erkek Giyim',
    price,
    colors: [color],
    sizes: unique(
      variants.map((variant) => variant.size).filter(Boolean) as string[],
    ),
    stocks: variants.map((variant) => variant.stock),
    attributes,
    variants,
    source: {
      productId,
      url,
      capturedAt: CAPTURED_AT,
      images,
      sellerName: asString(merchant.name) || 'DeFacto',
      barcode: asString(winnerVariant.barcode) || undefined,
      productCode: code,
      stockCode: asString(winnerVariant.listingId) || undefined,
      stockText: product.inStock === true ? 'Stokta' : 'Tükendi',
      maximumOrderQuantity: asNumber(winnerVariant.maxSaleLimit),
      sizeChartUrl: asString(product.sizeChartUrl) || undefined,
    },
  };
}

function markdownPlainText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\*\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hepsiburadaPrice(markdown: string): number {
  const anchor = markdown.indexOf('Satıcı:');
  const priceArea = markdown.slice(anchor, anchor + 2_500);
  const preferred = priceArea.match(
    /(?:Sepete özel fiyat|Sepet fiyatı)[\s\S]{0,100}?(\d[\d.]*,\d{2}|\d[\d.]*) TL/i,
  );
  const fallback = priceArea.match(/(\d[\d.]*,\d{2}) TL/);
  const raw = preferred?.[1] ?? fallback?.[1] ?? '0';
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

function hepsiburadaImages(markdown: string): string[] {
  const urls = markdown.match(
    /https:\/\/productimages\.hepsiburada\.net\/s\/\d+\/(?:424-600|48-64)\/\d+\.(?:jpg|jpeg|png|webp)/gi,
  );
  const matches: string[] = urls ? Array.from(urls) : [];
  return unique(matches.map((url) => url.replace('/48-64/', '/424-600/')));
}

function hepsiburadaDescription(markdown: string, title: string): string {
  const heading = `### DeFacto ${title}`;
  const start = markdown.indexOf(heading);
  const fallbackStart = markdown.indexOf('### DeFacto');
  const descriptionStart = start >= 0 ? start : fallbackStart;
  const end = markdown.indexOf('Ürün özellikleri', descriptionStart);
  if (descriptionStart < 0 || end < 0) return title;
  return markdownPlainText(markdown.slice(descriptionStart, end));
}

function hepsiburadaAttributes(markdown: string): Array<{
  name: string;
  value: string;
}> {
  const start = markdown.indexOf('Ürün özellikleri');
  const end = markdown.indexOf('Hatalı içerik bildir', start);
  if (start < 0 || end < 0) return [];
  const lines = markdownPlainText(markdown.slice(start, end))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== 'Ürün özellikleri' && line !== 'Diğer');
  const attributes: Array<{ name: string; value: string }> = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    attributes.push({ name: lines[index], value: lines[index + 1] });
  }
  return attributes;
}

function hepsiburadaSizes(markdown: string): string[] {
  const match = markdown.match(
    /Beden:\s*[^\n]*\n([\s\S]{0,500}?)\nSepete ekle/i,
  );
  if (!match) return [];
  const allowed = /^(?:XS|S|M|L|XL|[2-6]XL|\d{2,3})$/i;
  return unique(
    match[1]
      .split('\n')
      .map((line) => markdownPlainText(line))
      .filter((line) => allowed.test(line)),
  );
}

function hepsiburadaProductFromMarkdown(
  url: string,
  markdown: string,
  index: number,
): MockProductSeed {
  const titleMatch = markdown.match(/^# \[DeFacto\]\([^)]+\)([^\n]+)$/m);
  const fallbackTitle = markdown.match(/^### DeFacto ([^\n]+)$/m);
  const title = (titleMatch?.[1] ?? fallbackTitle?.[1] ?? '').trim();
  const code =
    title.match(/\b[A-Z]\d{4}AX[A-Z0-9]+\b/i)?.[0]?.toUpperCase() ?? '';
  const listingId = url.match(/-p-(HBC[A-Z0-9]+)$/i)?.[1]?.toUpperCase() ?? '';
  const images = hepsiburadaImages(markdown);
  const attributes = hepsiburadaAttributes(markdown);
  const gender = attributeValue(attributes, ['cinsiyet']);
  if (!title || !code || !listingId || images.length === 0) {
    throw new Error(`${url} eksik ürün verisi içeriyor.`);
  }
  if (gender !== 'Erkek' || BANNED_PRODUCT_PATTERN.test(title)) {
    throw new Error(`${url} erkek dışı veya yasaklı kategoride.`);
  }
  const colorMatch = markdown.match(/^Renk:\s*([^\n]+)$/m);
  const color =
    colorMatch?.[1]?.trim() ??
    attributeValue(attributes, ['renk']) ??
    'Belirtilmemiş';
  const sizes = hepsiburadaSizes(markdown);
  const price = hepsiburadaPrice(markdown);
  const category =
    [
      ...markdown.matchAll(
        /\[Erkek ([^\]]+)\]\(https:\/\/www\.hepsiburada\.com\/[^)]+\)/g,
      ),
    ].at(-1)?.[1] ?? 'Erkek Giyim';
  const stockText = attributeValue(attributes, ['stok adedi']) ?? 'Stokta';
  const variantSizes: Array<string | null> = sizes.length ? sizes : [null];
  const variants: MockProductVariantSeed[] = variantSizes.map(
    (size, variantIndex) => ({
      externalId: `${listingId}-${size ?? variantIndex + 1}`,
      sku: `${code}-${size ?? variantIndex + 1}`,
      barcode: null,
      color,
      size,
      price,
      stock: /yok|tükendi/i.test(stockText) ? 0 : 1,
    }),
  );

  return {
    id: 2001 + index,
    code,
    title,
    description: hepsiburadaDescription(markdown, title),
    brand: 'DeFacto',
    category,
    price,
    colors: [color],
    sizes,
    stocks: variants.map((variant) => variant.stock),
    attributes,
    variants,
    source: {
      productId: listingId,
      url,
      capturedAt: CAPTURED_AT,
      images,
      sellerName: 'DeFacto',
      productCode: code,
      stockCode: listingId,
      stockText,
    },
  };
}

async function collectTrendyolProducts(): Promise<MockProductSeed[]> {
  const categoryHtml = Array.from({ length: 5 }, (_, index) =>
    fetchWithCurl(`${TRENDYOL_CATEGORY_URL}?pi=${index + 1}`),
  ).join('\n');
  const paths = unique(
    [
      ...categoryHtml.matchAll(
        /(?:href=)?["'](\/defacto\/[a-z0-9-]+-p-\d+)[?"']/gi,
      ),
    ].map((match) => match[1]),
  );
  const products: MockProductSeed[] = [];
  const usedCodes = new Set<string>();
  for (const path of paths) {
    if (products.length === PRODUCT_LIMIT) break;
    const url = `https://www.trendyol.com${path}`;
    try {
      const markdown = await fetchMarkdown(url);
      const product = trendyolProductFromUrl(url, markdown, products.length);
      if (usedCodes.has(product.code)) continue;
      usedCodes.add(product.code);
      products.push(product);
      console.log(
        `Trendyol ${products.length}/${PRODUCT_LIMIT}: ${product.code}`,
      );
    } catch (error) {
      console.warn(`Trendyol atlandı: ${url} — ${(error as Error).message}`);
    }
  }
  return products;
}

async function collectHepsiburadaProducts(): Promise<MockProductSeed[]> {
  const categoryUrlGroups: string[][] = [];
  for (const categoryUrl of HEPSIBURADA_CATEGORY_URLS) {
    const markdown = await fetchMarkdown(categoryUrl);
    categoryUrlGroups.push(
      unique(
        markdown.match(
          /https:\/\/www\.hepsiburada\.com\/defacto-[^\s)"?]+-p-HBC[A-Z0-9]+/gi,
        ) ?? [],
      ).filter((url) => !BANNED_PRODUCT_PATTERN.test(url)),
    );
  }
  const candidateUrls: string[] = [];
  const longestGroup = Math.max(
    ...categoryUrlGroups.map((group) => group.length),
  );
  for (let index = 0; index < longestGroup; index += 1) {
    for (const group of categoryUrlGroups) {
      if (group[index]) candidateUrls.push(group[index]);
    }
  }

  const products: MockProductSeed[] = [];
  const usedCodes = new Set<string>();
  for (const url of unique(candidateUrls)) {
    if (products.length === PRODUCT_LIMIT) break;
    try {
      const markdown = await fetchMarkdown(url);
      const product = hepsiburadaProductFromMarkdown(
        url,
        markdown,
        products.length,
      );
      if (usedCodes.has(product.code)) continue;
      usedCodes.add(product.code);
      products.push(product);
      console.log(
        `Hepsiburada ${products.length}/${PRODUCT_LIMIT}: ${product.code}`,
      );
    } catch (error) {
      console.warn(`Hepsiburada atlandı: ${url} — ${(error as Error).message}`);
    }
  }
  return products;
}

function validateProducts(provider: string, products: MockProductSeed[]) {
  if (products.length !== PRODUCT_LIMIT) {
    throw new Error(
      `${provider}: ${PRODUCT_LIMIT} yerine ${products.length} ürün bulundu.`,
    );
  }
  const codes = new Set<string>();
  const urls = new Set<string>();
  const imageOwners = new Map<string, string>();
  for (const product of products) {
    if (codes.has(product.code))
      throw new Error(`${provider}: yinelenen kod ${product.code}`);
    if (!product.source?.url || urls.has(product.source.url)) {
      throw new Error(
        `${provider}: eksik/yinelenen ürün URL'si ${product.code}`,
      );
    }
    if (BANNED_PRODUCT_PATTERN.test(product.title)) {
      throw new Error(`${provider}: yasaklı ürün ${product.title}`);
    }
    if (!product.source.images.length) {
      throw new Error(`${provider}: görselsiz ürün ${product.code}`);
    }
    for (const image of product.source.images) {
      const owner = imageOwners.get(image);
      if (owner && owner !== product.code) {
        throw new Error(
          `${provider}: ${image} hem ${owner} hem ${product.code} ürününde.`,
        );
      }
      imageOwners.set(image, product.code);
    }
    codes.add(product.code);
    urls.add(product.source.url);
  }
}

function writeFixture(
  fileName: string,
  exportName: string,
  sourceLabel: string,
  products: MockProductSeed[],
) {
  const filePath = resolve(
    process.cwd(),
    'src/modules/channels/providers/fixtures',
    fileName,
  );
  const body = `// ${sourceLabel}, captured ${CAPTURED_AT}.\n// Generated by src/scripts/refresh-marketplace-fixtures.ts.\nimport type { MockProductSeed } from '../mock-catalog.connector';\n\nexport const ${exportName}: MockProductSeed[] = ${JSON.stringify(products, null, 2)};\n`;
  writeFileSync(filePath, body, 'utf8');
}

async function main() {
  const provider = process.argv
    .find((argument) => argument.startsWith('--provider='))
    ?.split('=')[1];
  if (!provider || provider === 'trendyol') {
    const trendyolProducts = await collectTrendyolProducts();
    validateProducts('Trendyol', trendyolProducts);
    writeFixture(
      'trendyol-defacto-product-seeds.ts',
      'TRENDYOL_DEFACTO_PRODUCT_SEEDS',
      'Public Trendyol DeFacto men product-page snapshots',
      trendyolProducts,
    );
  }
  if (!provider || provider === 'hepsiburada') {
    const hepsiburadaProducts = await collectHepsiburadaProducts();
    validateProducts('Hepsiburada', hepsiburadaProducts);
    writeFixture(
      'hepsiburada-defacto-product-seeds.ts',
      'HEPSIBURADA_DEFACTO_PRODUCT_SEEDS',
      'Public Hepsiburada DeFacto men product-page snapshots',
      hepsiburadaProducts,
    );
  }
  console.log('Marketplace fixture yenilemesi tamamlandı.');
}

void main();
