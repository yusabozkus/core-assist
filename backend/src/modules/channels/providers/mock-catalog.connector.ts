import { Injectable } from '@nestjs/common';
import type {
  ConnectorContext,
  InventoryBatch,
  InventoryLookup,
  NormalizedProduct,
  ProductBatch,
  ProviderCredentials,
} from './catalog-connector';
import { TRENDYOL_DEFACTO_PRODUCT_SEEDS } from './fixtures/trendyol-defacto-product-seeds';
import { HEPSIBURADA_DEFACTO_PRODUCT_SEEDS } from './fixtures/hepsiburada-defacto-product-seeds';
import { createHepsiburadaMenSizeGuide } from './hepsiburada-men-size-guide';

const TEST_PRODUCT_IMAGE_URL =
  'https://cdn.dsmcdn.com/mnresize/420/620/ty1000441/product/media/images/prod/PIM/20260820/13/c81dfbf2-a9fa-48b2-8445-c0d16249ea71/1_org_zoom.jpg';

// 30 Trendyol DeFacto + 30 Hepsiburada DeFacto men's catalogue snapshots.
export const MOCK_PRODUCTS_PER_PROVIDER = 30;
export const MOCK_PRODUCTS_TOTAL = 60;

export type MockProductVariantSeed = {
  externalId: string;
  sku: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  price: number;
  stock: number;
};

export type MockProductSeed = {
  id: number;
  code: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  colors: string[];
  sizes?: string[];
  stocks: number[];
  attributes: Array<{ name: string; value: string }>;
  variants?: MockProductVariantSeed[];
  source?: {
    productId: number | string;
    url: string;
    capturedAt: string;
    images: string[];
    sellerName?: string;
    barcode?: string;
    productCode?: string;
    stockCode?: string;
    stockText?: string;
    maximumOrderQuantity?: number;
    sizeChartUrl?: string;
  };
};

@Injectable()
export class MockCatalogConnector {
  verifyCredentials(
    providerKey: string,
    credentials: ProviderCredentials,
  ): Promise<void> {
    void providerKey;
    void credentials;
    return Promise.resolve();
  }

  fetchProducts(
    providerKey: string,
    context: ConnectorContext,
  ): Promise<ProductBatch> {
    void context;

    return Promise.resolve({
      products:
        providerKey === 'hepsiburada'
          ? createHepsiburadaProducts()
          : createTrendyolProducts(),
    });
  }

  fetchInventory(
    providerKey: string,
    context: ConnectorContext,
  ): Promise<InventoryBatch> {
    void context;
    const products =
      providerKey === 'hepsiburada'
        ? createHepsiburadaProducts()
        : createTrendyolProducts();

    return Promise.resolve({
      variants: products.flatMap((product) =>
        product.variants.map((variant) => ({
          externalProductId: product.externalId,
          externalVariantId: variant.externalId,
          sku: variant.sku,
          barcode: variant.barcode,
          price: variant.price,
          currency: variant.currency,
          stock: variant.stock,
          sourceUpdatedAt: variant.sourceUpdatedAt,
        })),
      ),
    });
  }

  async fetchInventoryByReferences(
    providerKey: string,
    context: ConnectorContext,
    lookup: InventoryLookup,
  ): Promise<InventoryBatch> {
    const inventory = await this.fetchInventory(providerKey, context);
    const externalVariantIds = new Set(
      lookup.variants.map((variant) => variant.externalVariantId),
    );
    const skus = new Set(lookup.variants.map((variant) => variant.sku));
    const barcodes = new Set(
      lookup.variants.flatMap((variant) =>
        variant.barcode ? [variant.barcode] : [],
      ),
    );

    return {
      variants: inventory.variants.filter(
        (variant) =>
          variant.externalProductId === lookup.externalProductId ||
          externalVariantIds.has(variant.externalVariantId) ||
          skus.has(variant.sku) ||
          Boolean(variant.barcode && barcodes.has(variant.barcode)),
      ),
    };
  }
}

function createTrendyolProducts(): ProductBatch['products'] {
  return TRENDYOL_DEFACTO_PRODUCT_SEEDS.map((seed) =>
    createMockProduct('trendyol', seed),
  );
}

function createHepsiburadaProducts(): ProductBatch['products'] {
  return HEPSIBURADA_DEFACTO_PRODUCT_SEEDS.map((seed) =>
    createMockProduct('hepsiburada', seed),
  );
}

function createMockProduct(
  provider: 'trendyol' | 'hepsiburada',
  seed: MockProductSeed,
): NormalizedProduct {
  const providerPrefix = provider === 'trendyol' ? 'ty' : 'hb';
  const externalPrefix = provider === 'trendyol' ? 'ty-content' : 'hb-listing';
  const description = createMarketplaceDescription(seed);
  const attributes = createMarketplaceAttributes(seed);
  const sizes: Array<string | undefined> = seed.sizes ?? [undefined];
  const variants =
    seed.variants ??
    seed.colors.flatMap((color) =>
      sizes.map((size) => ({
        externalId: '',
        sku: '',
        barcode: null,
        color,
        size: size ?? null,
        price: seed.price,
        stock: 0,
      })),
    );

  return {
    externalId: `${externalPrefix}-${seed.source?.productId ?? seed.id}`,
    externalUrl:
      seed.source?.url ??
      (provider === 'trendyol'
        ? 'https://www.trendyol.com/'
        : 'https://www.hepsiburada.com/'),
    title: seed.title,
    description,
    brand: seed.brand,
    category: seed.category,
    attributes,
    images: seed.source?.images ?? [TEST_PRODUCT_IMAGE_URL],
    sizeGuide: seed.source?.sizeChartUrl
      ? { sourceUrl: seed.source.sizeChartUrl }
      : provider === 'hepsiburada'
        ? createHepsiburadaMenSizeGuide(seed.category)
        : undefined,
    variants: variants.map((variant, index) => {
      const generatedSku = `${seed.code}-${seed.id}-${String(index + 1).padStart(2, '0')}`;
      const generatedBarcode = `869${provider === 'trendyol' ? '1' : '2'}${String(seed.id).padStart(4, '0')}${String(index + 1).padStart(5, '0')}`;
      const isSingleVariant = variants.length === 1;
      const isSourceVariant = Boolean(seed.variants);

      return {
        externalId: isSourceVariant
          ? variant.externalId
          : `${providerPrefix}-variant-${seed.source?.productId ?? seed.id}-${index + 1}`,
        title: [variant.color, variant.size].filter(Boolean).join(' / '),
        // Use marketplace SKU/barcode only when it is clearly product == variant.
        sku: isSourceVariant
          ? variant.sku
          : isSingleVariant && seed.source?.stockCode
            ? seed.source.stockCode
            : generatedSku,
        barcode:
          (isSourceVariant ? variant.barcode : null) ??
          (isSingleVariant && seed.source?.barcode
            ? seed.source.barcode
            : generatedBarcode),
        color: variant.color ?? undefined,
        size: variant.size ?? undefined,
        price: variant.price,
        currency: 'TRY',
        // Trendyol exposes an exact snapshot for the selected variant, while
        // the remaining variants generally expose only availability. Those
        // variants use 1/0 as a connector-level availability proxy.
        stock: isSourceVariant
          ? variant.stock
          : seed.stocks[index % seed.stocks.length],
      };
    }),
    rawPayload: {
      fixture: true,
      provider,
      fixtureSource: seed.source
        ? {
            type: 'PUBLIC_MARKETPLACE_SNAPSHOT',
            productId: seed.source.productId,
            url: seed.source.url,
            capturedAt: seed.source.capturedAt,
            productCode: seed.source.productCode ?? null,
            marketplaceBarcode: seed.source.barcode ?? null,
            marketplaceStockCode: seed.source.stockCode ?? null,
            sizeChartUrl: seed.source.sizeChartUrl ?? null,
          }
        : { type: 'SYNTHETIC' },
      contentId: seed.source?.productId ?? `${externalPrefix}-${seed.id}`,
      title: seed.title,
      description,
      attributes,
      seller: {
        name:
          seed.source?.sellerName ??
          (provider === 'trendyol'
            ? 'Test Trendyol Satıcısı'
            : 'Test Hepsiburada Satıcısı'),
      },
      commercialInfo: {
        stockText: seed.source?.stockText ?? null,
        numericStockIsAvailabilityProxy: Boolean(
          seed.source?.stockText && !seed.variants,
        ),
        variantStockSemantics: seed.variants
          ? 'SELECTED_EXACT_OTHER_VARIANTS_AVAILABILITY_PROXY'
          : 'NUMERIC_STOCK',
        maximumOrderQuantity: seed.source?.maximumOrderQuantity ?? null,
        freeReturnDays: provider === 'trendyol' ? 15 : null,
        sellerDeterminesPrice: true,
      },
    },
  };
}

function createMarketplaceDescription(seed: MockProductSeed) {
  // Real marketplace snapshots must remain source-faithful. Never enrich or
  // paraphrase them here; the fixture refresh process owns their exact content.
  if (seed.source) {
    // Fixtures captured before source descriptions were supported stored a
    // title followed by copied attribute rows as if it were marketplace copy.
    // Do not expose that legacy synthetic text to the UI or the AI.
    return looksLikeLegacySyntheticDescription(seed) ? '' : seed.description;
  }

  const careInstructions = createCareInstructions(seed);
  const sizeInformation = seed.sizes?.length
    ? `Ürün ${seed.sizes.join(', ')} beden seçenekleriyle sunulur.`
    : 'Ürün standart ölçü seçeneğiyle sunulur.';

  return [
    seed.description,
    `${seed.title}, ${seed.category.toLocaleLowerCase('tr-TR')} kategorisinde günlük kullanıma uyum sağlayan işlevsel bir modeldir.`,
    `${seed.colors.join(', ')} renk seçenekleri farklı kombinlerle kullanım imkânı sunar.`,
    sizeInformation,
    'Ürünün materyal, kalıp ve diğer teknik bilgileri ürün özellikleri bölümünde ayrıntılı olarak belirtilmiştir.',
    'Ürünün formunu ve yüzeyini korumak için kullanım sırasında sert darbe, kesici yüzey ve uygun olmayan kimyasallarla temastan kaçınılmalıdır.',
    'Yıkama ve Kullanma Talimatları',
    careInstructions,
  ].join('\n\n');
}

function looksLikeLegacySyntheticDescription(seed: MockProductSeed) {
  const lines = seed.description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] !== seed.title || lines.length < 4) return false;

  const attributeRows = new Set(
    seed.attributes.map((attribute) =>
      `${attribute.name}: ${attribute.value}`.trim(),
    ),
  );
  const matchingRows = lines
    .slice(1)
    .filter((line) => attributeRows.has(line)).length;

  return matchingRows >= Math.min(3, seed.attributes.length);
}

function createMarketplaceAttributes(seed: MockProductSeed) {
  if (seed.source) return seed.attributes;

  const careInstructions = createCareInstructions(seed);
  const material = seed.attributes.find((attribute) =>
    /(materyal|kumaş|dokuma)/i.test(attribute.name),
  );
  const hasMaterialComposition = seed.attributes.some((attribute) =>
    /materyal bileşeni/i.test(attribute.name),
  );
  const commonAttributes = [
    { name: 'Sezon', value: 'Tüm Sezonlar' },
    { name: 'Renk Seçenekleri', value: seed.colors.join(', ') },
    { name: 'Menşei', value: 'TR' },
    { name: 'Koleksiyon', value: 'Casual / Günlük' },
    ...(seed.sizes?.length
      ? [{ name: 'Beden Seçenekleri', value: seed.sizes.join(', ') }]
      : []),
    ...(material && !hasMaterialComposition
      ? [{ name: 'Materyal Bileşeni', value: material.value }]
      : []),
    { name: 'Yıkama Talimatları', value: careInstructions },
  ];

  return [
    ...new Map(
      [...seed.attributes, ...commonAttributes].map((attribute) => [
        `${attribute.name.toLocaleLowerCase('tr-TR')}:${attribute.value.toLocaleLowerCase('tr-TR')}`,
        attribute,
      ]),
    ).values(),
  ];
}

function createCareInstructions(seed: MockProductSeed) {
  const searchableProduct = `${seed.title} ${seed.category} ${seed.attributes
    .map((attribute) => `${attribute.name} ${attribute.value}`)
    .join(' ')}`.toLocaleLowerCase('tr-TR');

  if (searchableProduct.includes('deri')) {
    return 'Su ile yıkamayınız. Gerektiğinde hafif nemli ve yumuşak bir bezle temizleyiniz. Kimyasal temizleyici ve ağartıcı kullanmayınız.';
  }
  if (/(çanta|valiz|cüzdan)/i.test(seed.category)) {
    return 'Nemli ve yumuşak bir bezle nazikçe temizleyiniz. Makinede yıkamayınız.';
  }
  if (/(ayakkabı|bot|loafer|sandalet|terlik)/i.test(seed.category)) {
    return 'Yüzeyi yumuşak bir bezle temizleyiniz. Makinede yıkamayınız.';
  }
  return 'Ürün etiketindeki bakım talimatlarına uyunuz.';
}

const TRENDYOL_PRODUCT_SEEDS: MockProductSeed[] = [
  {
    id: 1001,
    code: 'H3067AX26AU',
    title: 'Regular Fit Gömlek Yaka Pamuklu Mont H3067AX26AU',
    description:
      'Pamuk ve polyester karışımlı kumaştan üretilmiş, regular fit gömlek yakalı, astarlı ve uzun kollu ekru mont. İlanda M beden manken için 76 cm göğüs, 60 cm bel, 90 cm basen ve 1,73 m boy bilgileri veriliyor; XS–XL için ayrı ürün uzunluk ölçüleri listeleniyor.',
    brand: 'DeFacto',
    category: 'Mont',
    price: 2499.99,
    colors: ['Ekru'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    stocks: [1, 1, 1, 1, 1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Regular',
      },
      {
        name: 'Materyal',
        value: 'Pamuk Polyester',
      },
      {
        name: 'Astar Durumu',
        value: 'Astarlı',
      },
      {
        name: 'Yaka Tipi',
        value: 'Gömlek Yaka',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Belirtilmemiş',
      },
      {
        name: 'Renk',
        value: 'Ekru',
      },
      {
        name: 'Desen',
        value: 'Düz',
      },
      {
        name: 'Kol Boyu',
        value: 'Uzun',
      },
      {
        name: 'Kol Tipi',
        value: 'Standart Kol',
      },
      {
        name: 'Kalınlık',
        value: 'Kalın',
      },
      {
        name: 'Boy',
        value: 'Regular',
      },
      {
        name: 'Ortam',
        value: 'Casual/Günlük',
      },
      {
        name: 'Siluet',
        value: 'Regular',
      },
      {
        name: 'Koleksiyon',
        value: 'Casual / Günlük',
      },
      {
        name: 'Dolgu Tekniği',
        value: 'Dolgusuz',
      },
      {
        name: 'Kemer/Kuşak Durumu',
        value: 'Kemersiz',
      },
      {
        name: 'Persona',
        value: 'Young',
      },
      {
        name: 'Menşei',
        value: 'MM',
      },
      {
        name: 'Materyal Bileşeni',
        value: 'Poliester 100%,Pamuk 100%',
      },
      {
        name: 'Yıkama Talimatları',
        value:
          'AĞARTICI KULLANMAYINIZ MAKSİMUM 30 °C SICAKLIKTA YIKAYINIZ TAMBURLU KURUTMA YAPMAYINIZ KURU TEMİZLEME YAPILAMAZ DÜŞÜK SICAKLIKTA ÜTÜLEYİNİZ',
      },
      {
        name: 'Ürün Kodu',
        value: 'H3067AX26AU',
      },
      {
        name: 'Barkod No',
        value: '8684585961868',
      },
      {
        name: 'Stok Bilgisi',
        value: '10 adetten fazla',
      },
      {
        name: 'Manken Bilgileri',
        value: 'Ekru-ER128: Göğüs 76 cm, Boy 1,73 m, Basen 90 cm, Bel 60 cm',
      },
      {
        name: 'Manken Bedeni',
        value: 'M',
      },
      {
        name: 'Ürün Uzunluk Ölçüleri',
        value:
          'XL-58,5 cm, XL-17,8 cm, XL-24 cm, XL-59,5 cm, XL-85 cm, XL-59 cm; L-58 cm, L-23 cm, L-55,5 cm, L-56,5 cm, L-17,4 cm, L-84 cm; S-51 cm, S-82 cm, S-21,6 cm, S-56 cm, S-52 cm, S-16,6 cm; XS-49 cm, XS-50 cm, XS-21,2 cm, XS-16,2 cm, XS-81 cm, XS-55 cm; M-17 cm, M-57 cm, M-54 cm, M-83 cm, M-53 cm, M-22 cm',
      },
    ],
    source: {
      productId: 1177521630,
      url: 'https://www.trendyol.com/defacto/regular-fit-gomlek-yaka-pamuklu-mont-h3067ax26au-p-1177521630',
      capturedAt: '2026-08-31',
      sellerName: 'DeFacto',
      barcode: '8684585961868',
      productCode: 'H3067AX26AU',
      stockText: '10 adetten fazla',
      maximumOrderQuantity: 10,
      images: [
        'https://cdn.dsmcdn.com/mnresize/620/920/ty1922/prod/QC_PREP/20260730/02/0822e0fb-fc23-3070-8dce-9a2e69e0b663/1_org_zoom.jpg',
        'https://cdn.dsmcdn.com/mnresize/620/920/ty1892/prod/QC_PREP/20260730/02/34b2e07b-b61b-358b-981e-6cab46596881/1_org_zoom.jpg',
        'https://cdn.dsmcdn.com/mnresize/620/920/ty1929/prod/QC_PREP/20260730/02/3e5d3260-841e-3bdf-90f3-98d32655e82c/1_org_zoom.jpg',
      ],
    },
  },
  {
    id: 1002,
    code: 'TY-958740522',
    title: 'Unisex Kadın DENİZ YILDIZI Baskılı Beyaz Pamuklu T-Shirt',
    description:
      'Deniz yıldızı dijital baskılı, regular kalıp, beyaz unisex bisiklet yaka tişört.',
    brand: 'Framgan',
    category: 'T-Shirt',
    price: 189.5,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Regular',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Paket İçeriği',
        value: 'Tekli',
      },
      {
        name: 'Koleksiyon',
        value: 'Young',
      },
      {
        name: 'Desen',
        value: 'Dijital Baskı',
      },
      {
        name: 'Materyal',
        value: 'Süprem',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
    ],
    source: {
      productId: 958740522,
      url: 'https://www.trendyol.com/framgan/unisex-kadin-deniz-yildizi-baskili-beyaz-pamuklu-t-shirt-p-958740522',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1715/prod/QC_PREP/20250720/17/e723d51b-ff8b-3cfa-9769-8eddd9172e98/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 02',
    },
  },
  {
    id: 1003,
    code: 'TY-1097492910',
    title: 'Fitilli Kadın T-Shirt, Kadın Tişört',
    description:
      'Fitilli dokulu, bisiklet yaka, kısa kollu ve relaxed kalıp kadın tişört.',
    brand: 'PAULMARK',
    category: 'T-Shirt',
    price: 499.99,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', 'XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Relaxed',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Materyal',
        value: 'Pamuklu',
      },
      {
        name: 'Desen',
        value: 'Düz',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Belirtilmemiş',
      },
      {
        name: 'Kol Tipi',
        value: 'Kısa Kol',
      },
      {
        name: 'Cep',
        value: 'Cepsiz',
      },
      {
        name: 'Boy',
        value: 'Normal Boy',
      },
      {
        name: 'Dokuma Tipi',
        value: 'Fitilli',
      },
      {
        name: 'Menşei',
        value: 'TR',
      },
    ],
    source: {
      productId: 1097492910,
      url: 'https://www.trendyol.com/paulmark/fitilli-kadin-t-shirt-kadin-tisort-p-1097492910',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/-/280/ty1361/product/media/images/prod/QC/20240613/00/5d940f3b-8c67-3c90-b000-c7d38eaa8547/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 03',
    },
  },
  {
    id: 1004,
    code: 'TY-828255851',
    title: 'Red Cherries Baskılı Oversize Kadın/Erkek Unisex Beyaz Tshirt',
    description:
      'Red Cherries dijital baskılı, oversize unisex beyaz tişört; pamuk-polyester karışımlı olarak listeleniyor.',
    brand: 'Elvino',
    category: 'T-Shirt',
    price: 199.0,
    colors: ['Beyaz'],
    sizes: [
      'S',
      'M',
      'M/L',
      'L',
      'XL',
      '2XL',
      '2XL-3XL',
      '3XL/4XL',
      '3XL-4XL',
      '4XL',
      '4XL-5XL',
      '5XL',
    ],
    stocks: [1],
    attributes: [
      {
        name: 'Paket İçeriği',
        value: 'Tekli',
      },
      {
        name: 'Kalıp',
        value: 'Oversize',
      },
      {
        name: 'Materyal',
        value: 'Pamuk Polyester',
      },
      {
        name: 'Desen',
        value: 'Baskılı',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Kol Tipi',
        value: 'Düşük Kol',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
      {
        name: 'Ortam',
        value: 'Casual/Günlük',
      },
      {
        name: 'Boy',
        value: 'Regular',
      },
      {
        name: 'Kol Boyu',
        value: 'Kısa',
      },
      {
        name: 'Dokuma Tipi',
        value: 'Süprem',
      },
      {
        name: 'Baskı/Nakış Tekniği',
        value: 'Dijital Baskı',
      },
      {
        name: 'Koleksiyon',
        value: 'Unisex',
      },
    ],
    source: {
      productId: 828255851,
      url: 'https://www.trendyol.com/elvino/red-cherries-baskili-oversize-kadin-erkek-unisex-beyaz-tshirt-p-828255851',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1610/prod/QC/20241203/21/0c2ca914-c633-38da-93cc-d5b8e9ce58ce/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 04',
    },
  },
  {
    id: 1005,
    code: 'TY-1054125346',
    title:
      'Unisex Kurdele Bordo Renkli Özel Baskılı Basic Bisiklet Yaka Regular T-shirt %100 Pamuk',
    description:
      'Kurdele bordo baskılı, regular kalıp, bisiklet yaka ve %100 pamuk unisex tişört.',
    brand: 'one button',
    category: 'T-Shirt',
    price: 166.99,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Regular',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Materyal',
        value: 'Pamuklu',
      },
      {
        name: 'Paket İçeriği',
        value: '1+',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Desen',
        value: 'Baskılı',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
    ],
    source: {
      productId: 1054125346,
      url: 'https://www.trendyol.com/one-button/unisex-kurdele-bordo-renkli-ozel-baskili-basic-bisiklet-yaka-regular-t-shirt-100-pamuk-p-1054125346',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1791/prod/QC_PREP/20251121/20/d1749d56-5b5c-390f-afce-e3667a34ba75/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 05',
    },
  },
  {
    id: 1006,
    code: 'TY-904030533',
    title: 'Biyeli Bisiklet Yaka T-Shirt',
    description:
      'Biyeli detaylı, siyah, regular kalıp ve bisiklet yaka kadın tişört.',
    brand: 'ESRAHELVACI',
    category: 'T-Shirt',
    price: 284.42,
    colors: ['Siyah'],
    sizes: ['S', 'M', 'L'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Regular',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Paket İçeriği',
        value: 'Tekli',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Desen',
        value: 'Düz',
      },
      {
        name: 'Materyal',
        value: 'Pamuk',
      },
      {
        name: 'Renk',
        value: 'Siyah',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Dokuma',
      },
      {
        name: 'Kol Tipi',
        value: 'Kısa Kol',
      },
      {
        name: 'Cep',
        value: 'Cepsiz',
      },
      {
        name: 'Ürün Detayı',
        value: 'Biyeli',
      },
      {
        name: 'Ortam',
        value: 'Günlük',
      },
      {
        name: 'Baskı/Nakış Tekniği',
        value: 'Baskısız',
      },
      {
        name: 'Menşei',
        value: 'TR',
      },
    ],
    source: {
      productId: 904030533,
      url: 'https://www.trendyol.com/esrahelvaci/biyeli-bisiklet-yaka-t-shirt-p-904030533',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1644/prod/QC/20250304/12/6db4cbe6-bb92-323b-9092-454e74619cb6/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 06',
    },
  },
  {
    id: 1007,
    code: 'TY-1078922659',
    title:
      'Unisex Coffee Club Çift Taraf Baskılı Basic Bisiklet Yaka Regular T-shirt %100 Pamuk',
    description:
      'Coffee Club çift taraf baskılı, regular kalıp, bisiklet yaka ve %100 pamuk unisex tişört.',
    brand: 'one button',
    category: 'T-Shirt',
    price: 179.99,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', '2XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Regular',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Materyal',
        value: 'Pamuklu',
      },
      {
        name: 'Paket İçeriği',
        value: '1+',
      },
      {
        name: 'Desen',
        value: 'Baskılı',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Örme',
      },
    ],
    source: {
      productId: 1078922659,
      url: 'https://www.trendyol.com/one-button/unisex-coffee-club-cift-taraf-baskili-basic-bisiklet-yaka-regular-t-shirt-100-pamuk-p-1078922659',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1807/prod/QC_PREP/20260102/16/8b01030f-9864-33e5-9180-8971a37a6966/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 07',
    },
  },
  {
    id: 1008,
    code: 'TY-1167646846',
    title: 'Kadın Kontrast Yakalı Kadın T-Shirt, Kadın Tişört',
    description: 'Kontrast yakalı, relaxed kalıp, kısa kollu kadın tişört.',
    brand: 'PAULMARK',
    category: 'T-Shirt',
    price: 449.0,
    colors: ['Taş'],
    sizes: ['S', 'M', 'L', 'XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Relaxed',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Desen',
        value: 'Düz',
      },
      {
        name: 'Renk',
        value: 'Ekru',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Belirtilmemiş',
      },
      {
        name: 'Kol Tipi',
        value: 'Kısa Kol',
      },
      {
        name: 'Cep',
        value: 'Cepsiz',
      },
      {
        name: 'Kol Boyu',
        value: 'Kısa',
      },
      {
        name: 'Boy',
        value: 'Normal Boy',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Menşei',
        value: 'TR',
      },
    ],
    source: {
      productId: 1167646846,
      url: 'https://www.trendyol.com/paulmark/kadin-kontrast-yakali-kadin-t-shirt-kadin-tisort-p-1167646846',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1929/prod/QC_PREP/20260711/11/3231dbdb-d5b3-3fe0-86f9-ab801e452613/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 08',
    },
  },
  {
    id: 1009,
    code: 'TY-1047548174',
    title: 'Kadın Yazılı Kısa Kadın T-Shirt, Kadın Tişört',
    description: 'Yazı baskılı, kısa boy, relaxed kalıp kadın tişört.',
    brand: 'PAULMARK',
    category: 'T-Shirt',
    price: 499.99,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', 'XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Relaxed',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Materyal',
        value: 'Pamuklu',
      },
      {
        name: 'Paket İçeriği',
        value: 'Tekli',
      },
      {
        name: 'Desen',
        value: 'Yazı Karakterli / Motto',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
      {
        name: 'Kumaş Tipi',
        value: 'Belirtilmemiş',
      },
    ],
    source: {
      productId: 1047548174,
      url: 'https://www.trendyol.com/paulmark/kadin-yazili-kisa-kadin-t-shirt-kadin-tisort-p-1047548174',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1786/prod/QC_PREP/20251110/11/90a3a68b-a722-35c7-8450-573eb6ce406f/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 09',
    },
  },
  {
    id: 1010,
    code: 'TY-946800544',
    title:
      'Unisex Erkek/Kadın CHERRIES Özel Baskılı Oversize Pamuklu Bisiklet Yaka T-Shirt',
    description:
      'Cherries özel baskılı, oversize unisex beyaz tişört; materyal bilgisi %80 pamuk %20 rejene olarak listeleniyor.',
    brand: 'Framgan',
    category: 'T-Shirt',
    price: 192.9,
    colors: ['Beyaz'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    stocks: [1],
    attributes: [
      {
        name: 'Kalıp',
        value: 'Oversize',
      },
      {
        name: 'Yaka Tipi',
        value: 'Bisiklet Yaka',
      },
      {
        name: 'Paket İçeriği',
        value: 'Tekli',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Desen',
        value: 'Dijital Baskı',
      },
      {
        name: 'Materyal',
        value: '%80 Pamuk %20 Rejene',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
    ],
    source: {
      productId: 946800544,
      url: 'https://www.trendyol.com/framgan/unisex-erkek-kadin-cherries-ozel-baskili-oversize-pamuklu-bisiklet-yaka-t-shirt-p-946800544',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1697/prod/QC_PREP/20250621/03/bce36017-63ad-3a0c-a446-6aed176b6d15/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 10',
    },
  },
  {
    id: 1011,
    code: 'TY-1093288544',
    title: 'Erkek Günlük Ortopedik Sneaker Ayakkabı',
    description:
      'Tekstil/triko dış yüzeyli, ortopedik iç tabanlı, bağcıklı günlük erkek sneaker.',
    brand: 'mayback',
    category: 'Sneaker',
    price: 849.0,
    colors: ['Beyaz-Siyah'],
    sizes: ['36', '37', '38', '39', '41', '42', '43', '44'],
    stocks: [1],
    attributes: [
      {
        name: 'Bağlama Şekli',
        value: 'Bağcıklı',
      },
      {
        name: 'Materyal',
        value: 'PU',
      },
      {
        name: 'Taban Tipi',
        value: 'Poliüretan İç Taban',
      },
      {
        name: 'Koleksiyon',
        value: 'Care',
      },
      {
        name: 'Dış Materyal',
        value: 'Tekstil',
      },
      {
        name: 'İç Astar',
        value: 'Tekstil',
      },
      {
        name: 'Alt Taban',
        value: 'Poli',
      },
    ],
    source: {
      productId: 1093288544,
      url: 'https://www.trendyol.com/mayback/erkek-gunluk-ortopedik-sneaker-ayakkabi-p-1093288544',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1820/prod/QC_ENRICHMENT/20260203/23/d32beecf-8659-32d6-843a-40f52cf050a0/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 11',
    },
  },
  {
    id: 1012,
    code: 'TY-970901356',
    title: 'Tommy Erkek Sneaker Ayakkabı Beyaz',
    description:
      'Hakiki dana deri dış yüzeyli, kauçuk tabanlı beyaz erkek sneaker.',
    brand: 'LUFIAN',
    category: 'Sneaker',
    price: 1301.42,
    colors: ['Beyaz'],
    sizes: ['40', '41', '42', '43', '44', '45'],
    stocks: [1],
    attributes: [
      {
        name: 'Dış Materyal',
        value: 'Hakiki Deri',
      },
      {
        name: 'Bağlama Şekli',
        value: 'Bağcıklı',
      },
      {
        name: 'Materyal',
        value: 'Tekstil',
      },
      {
        name: 'Taban Tipi',
        value: 'Düz Taban',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Renk',
        value: 'Beyaz',
      },
      {
        name: 'İç Materyal',
        value: 'Tekstil',
      },
      {
        name: 'Alt Taban',
        value: 'Kauçuk',
      },
    ],
    source: {
      productId: 970901356,
      url: 'https://www.trendyol.com/lufian/tommy-erkek-sneaker-ayakkabi-beyaz-p-970901356',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1920/prod/QC_ENRICHMENT/20260610/12/0c51382c-8bc6-36fc-8ab7-d12b28f468d8/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 12',
    },
  },
  {
    id: 1013,
    code: 'TY-35839749',
    title: 'Beyaz Mavi Unisex Sneaker',
    description:
      'Beyaz-mavi, suni deri sayalı, ortopedik tabanlı unisex sneaker.',
    brand: 'Dark Seer',
    category: 'Sneaker',
    price: 828.85,
    colors: ['Beyaz Mavi'],
    sizes: [
      '35',
      '36',
      '37',
      '38',
      '39',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
    ],
    stocks: [1],
    attributes: [
      {
        name: 'Dış Materyal',
        value: 'Suni Deri',
      },
      {
        name: 'Materyal Bileşeni',
        value: '%90 PU %10 Suni Deri',
      },
      {
        name: 'Topuk Tipi',
        value: 'Düz Topuklu',
      },
      {
        name: 'Taban Özelliği',
        value: 'Ortopedik',
      },
      {
        name: 'Taban Tipi',
        value: 'Düz Taban',
      },
      {
        name: 'Bağlama Şekli',
        value: 'Bağcıklı',
      },
      {
        name: 'Topuk Boyu',
        value: 'Kısa Topuklu (1-4 cm)',
      },
      {
        name: 'Desen',
        value: 'Düz',
      },
    ],
    source: {
      productId: 35839749,
      url: 'https://www.trendyol.com/dark-seer/beyaz-mavi-unisex-sneaker-p-35839749',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1000077/product/media/images/prod/PIM/20260121/09/dd342772-9de1-4af6-8e8e-a9366b079206/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 13',
    },
  },
  {
    id: 1014,
    code: 'TY-951448992',
    title: 'Kalın Taban Beyaz Lacivert Erkek Snekaer',
    description:
      'Beyaz buz lacivert, suni deri dış materyalli, bağcıklı kalın taban erkek sneaker.',
    brand: 'L.A Polo',
    category: 'Sneaker',
    price: 848.67,
    colors: ['Beyaz Buz Lacivert'],
    sizes: [
      '36',
      '37',
      '38',
      '39',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
    ],
    stocks: [1],
    attributes: [
      {
        name: 'Bağlama Şekli',
        value: 'Bağcıklı',
      },
      {
        name: 'Materyal',
        value: 'Suni Deri',
      },
      {
        name: 'Taban Tipi',
        value: 'Düz Taban',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Dış Materyal',
        value: 'Suni Deri',
      },
      {
        name: 'Renk',
        value: 'Çok Renkli',
      },
      {
        name: 'İç Materyal',
        value: 'Suni Deri',
      },
      {
        name: 'Alt Taban',
        value: 'Poli',
      },
    ],
    source: {
      productId: 951448992,
      url: 'https://www.trendyol.com/l-a-polo/kalin-taban-beyaz-lacivert-erkek-snekaer-p-951448992',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1702/prod/QC_PREP/20250702/15/2cf00e70-7fcb-3a93-b738-2dc6e957a1e1/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 14',
    },
  },
  {
    id: 1015,
    code: 'TY-1126125069',
    title: 'Siyah Ortopedik İç Taban Akıllı Bağcıklı Erkek Spor Sneaker',
    description:
      'Siyah, ortopedik iç tabanlı, suni deri dış yüzeyli erkek sneaker.',
    brand: 'MY GROSS SHOES',
    category: 'Sneaker',
    price: 599.9,
    colors: ['Siyah'],
    sizes: ['40', '41', '42', '43', '44'],
    stocks: [1],
    attributes: [
      {
        name: 'Dış Materyal',
        value: 'Suni Deri',
      },
      {
        name: 'Taban Tipi',
        value: 'Düz Taban',
      },
      {
        name: 'Koleksiyon',
        value: 'Basic',
      },
      {
        name: 'Bağlama Şekli',
        value: 'Lastikli',
      },
      {
        name: 'Renk',
        value: 'Siyah',
      },
      {
        name: 'İç Materyal',
        value: 'Tekstil',
      },
      {
        name: 'Alt Taban',
        value: 'Poli',
      },
    ],
    source: {
      productId: 1126125069,
      url: 'https://www.trendyol.com/my-gross-shoes/siyah-ortopedik-ic-taban-akilli-bagcikli-erkek-spor-sneaker-p-1126125069',
      capturedAt: '2026-08-31',
      images: [
        'https://cdn.dsmcdn.com/mnresize/340/520/ty1934/prod/QC_ENRICHMENT/20260604/23/c861e466-5f52-3db9-9e88-861cb5fb3397/1_org_zoom.jpg',
      ],
      sellerName: 'Test Satıcı 15',
    },
  },
];

const HEPSIBURADA_PRODUCT_SEEDS: MockProductSeed[] = [
  {
    id: 2001,
    code: 'HBCV000029M1V7',
    title:
      'Aradığın Var Çöğür 0.18 Kısa Sap Saz Bağlama Teli 5 Adet Tezene Mızrap Hediyeli',
    description:
      'Kısa sap bağlama ve cura kullanımına yönelik 0.18 numara paslanmaz çelik tel seti; ilanda mızrap hediyesiyle sunuluyor.',
    brand: 'Aradığın Var',
    category: 'Bağlama Aksesuarı',
    price: 175.0,
    colors: ['Standart'],
    stocks: [1],
    attributes: [
      {
        name: 'Enstrüman',
        value: 'Bağlama',
      },
      {
        name: 'Ürün Tipi',
        value: 'Askı',
      },
      {
        name: 'Aksesuar Çeşidi',
        value: 'Bakım ve Temizlik Ekipmanları',
      },
      {
        name: 'Garanti Süresi',
        value: '1 Ay',
      },
      {
        name: 'Stok Adedi',
        value: '20 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV000029M1V7',
      },
    ],
    source: {
      productId: 'HBC000029M1V5',
      url: 'https://www.hepsiburada.com/aradigin-var-cogur-0-18-kisa-sap-saz-baglama-teli-5-adet-tezene-mizrap-hediyeli-pm-HBC000029M1V5',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/223/424-600/110000203418015.jpg',
      ],
      sellerName: 'Şenses Müzik Market',
      stockText: '20 adetten az',
      stockCode: 'HBCV000029M1V7',
    },
  },
  {
    id: 2002,
    code: 'HBCV000058RF0V',
    title: 'Aradığın Var Erkek Çocuk Eşofman 10 - 12 Yaş',
    description:
      'Siyah erkek çocuk eşofman altı; ilan ölçülerinde bacak boyu 85 cm, bel genişliği 30 cm ve 32–42 kg aralığına uyumluluk bilgisi veriliyor.',
    brand: 'Aradığın Var',
    category: 'Erkek Çocuk Eşofman',
    price: 349.9,
    colors: ['Siyah'],
    sizes: ['10 - 12 Yaş'],
    stocks: [1],
    attributes: [
      {
        name: 'Beden',
        value: '10 - 12 Yaş',
      },
      {
        name: 'Renk',
        value: 'Siyah',
      },
      {
        name: 'Bacak Boyu',
        value: '85 cm',
      },
      {
        name: 'Bel Genişliği',
        value: '30 cm',
      },
      {
        name: 'Uyumlu Kilo',
        value: '32 - 42 kg',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV000058RF0V',
      },
    ],
    source: {
      productId: 'HBC000058RF0U',
      url: 'https://www.hepsiburada.com/aradigin-var-erkek-cocuk-esofman-10-12-yas-pm-HBC000058RF0U',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/495/424-600/110000545712245.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV000058RF0V',
    },
  },
  {
    id: 2003,
    code: 'HBCV00005SPZ99',
    title: 'Aradığın Var 3 Ampullü Güneş Enerjili Ev Bahçe Aydınlatma Cihazı',
    description:
      'Güneş paneli, güç ünitesi ve üç ampullü aydınlatma seti. İlandaki kullanım bilgisinde tam şarjla tek ampulde yaklaşık 20 saat, iki ampulde 15 saat ve üç ampulde 8 saate kadar çalışma değerleri yer alıyor.',
    brand: 'Aradığın Var',
    category: 'Güneş Enerjili Aydınlatma',
    price: 1849.9,
    colors: ['Siyah'],
    stocks: [1],
    attributes: [
      {
        name: 'Adet',
        value: '1',
      },
      {
        name: 'Ampul Sayısı',
        value: '3',
      },
      {
        name: 'Tek Ampul Çalışma Süresi',
        value: '20 saate kadar',
      },
      {
        name: 'İki Ampul Çalışma Süresi',
        value: '15 saate kadar',
      },
      {
        name: 'Üç Ampul Çalışma Süresi',
        value: '8 saate kadar',
      },
      {
        name: 'Telefon Şarjı',
        value: 'Var',
      },
      {
        name: 'Panel Feneri',
        value: 'Var',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00005SPZ99',
      },
    ],
    source: {
      productId: 'HBC00005SPZ98',
      url: 'https://www.hepsiburada.com/aradigin-var-3-ampullu-gunes-enerjili-ev-bahce-aydinlatma-cihazi-pm-HBC00005SPZ98',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/552/424-600/110000614063650.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV00005SPZ99',
    },
  },
  {
    id: 2004,
    code: 'HBC0000601QPD',
    title: 'El Yapımı İnce Kesim Makarna Erişte 1 kg',
    description:
      'Ev yapımı ince kesim erişte; paket gramajı ilanda 1 kg olarak belirtiliyor.',
    brand: 'Aradığın Var',
    category: 'Makarna / Erişte',
    price: 399.9,
    colors: ['Standart'],
    stocks: [1],
    attributes: [
      {
        name: 'Makarna Türü',
        value: 'Erişte',
      },
      {
        name: 'Aroma',
        value: 'Aromasız',
      },
      {
        name: 'Gramaj',
        value: '1 kg',
      },
      {
        name: 'Stok Adedi',
        value: '20 adetten az',
      },
    ],
    source: {
      productId: 'HBC0000601QPD',
      url: 'https://www.hepsiburada.com/el-yapimi-ince-kesim-makarna-eriste-pm-HBC0000601QPD',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/339/424-600/110000345435295.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '20 adetten az',
    },
  },
  {
    id: 2005,
    code: 'HBCV000048JUP2',
    title: 'Aradığın Var İnce Belli Çay Bardağı 12 Adet',
    description:
      '12 parçalık şeffaf cam çay bardağı seti; her bardağın hacmi 130 ml ve ürün gıda temasına uygun olarak listeleniyor.',
    brand: 'Aradığın Var',
    category: 'Çay Bardağı',
    price: 579.9,
    colors: ['Şeffaf'],
    stocks: [1],
    attributes: [
      {
        name: 'Renk',
        value: 'Şeffaf',
      },
      {
        name: 'Parça Sayısı',
        value: '12 Parçalı',
      },
      {
        name: 'Materyal',
        value: 'Cam',
      },
      {
        name: 'Desen',
        value: 'Desenli',
      },
      {
        name: 'Kulplu',
        value: 'Hayır',
      },
      {
        name: 'Hacim',
        value: '130 ml',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV000048JUP2',
      },
    ],
    source: {
      productId: 'HBC000048JUP1',
      url: 'https://www.hepsiburada.com/aradigin-var-ince-belli-cay-bardagi-pm-HBC000048JUP1',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/398/424-600/110000423177476.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV000048JUP2',
    },
  },
  {
    id: 2006,
    code: 'HBCV00008KQCKE',
    title: 'Aradığın Var Bluetooth Kulaklık Powerbanklı',
    description:
      'Şarj kutusu powerbank işlevi de gören siyah TWS kulak içi Bluetooth kulaklık. İlanda Bluetooth 5.3, aktif gürültü engelleme ve dokunmatik kontrol özellikleri yer alıyor.',
    brand: 'Aradığın Var',
    category: 'Bluetooth Kulaklık',
    price: 649.9,
    colors: ['Siyah'],
    stocks: [1],
    attributes: [
      {
        name: 'Renk',
        value: 'Siyah',
      },
      {
        name: 'Suya & Tere Dayanıklı',
        value: 'Evet',
      },
      {
        name: 'Aktif Gürültü Önleme (ANC)',
        value: 'Var',
      },
      {
        name: 'TWS',
        value: 'Evet',
      },
      {
        name: 'Çift Telefon Desteği',
        value: 'Yok',
      },
      {
        name: 'Kulaklık Tipi',
        value: 'Kulakiçi',
      },
      {
        name: 'Bluetooth Versiyonu',
        value: '5.3',
      },
      {
        name: 'Dokunmatik Kontrol',
        value: 'Var',
      },
      {
        name: 'Powerbank Özelliği',
        value: 'Var',
      },
      {
        name: 'Stok Adedi',
        value: '20 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00008KQCKE',
      },
    ],
    source: {
      productId: 'HBC00008KQCKD',
      url: 'https://www.hepsiburada.com/aradigin-var-bluetooth-kulaklik-powerbankli-pm-HBC00008KQCKD',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001001297253.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '20 adetten az',
      stockCode: 'HBCV00008KQCKE',
    },
  },
  {
    id: 2007,
    code: 'HBCV00005TPJZF',
    title: 'Dantel Görünüm Ekmek Sepeti',
    description: 'Açık mavi renkte, dantel görünümlü dekoratif ekmek sepeti.',
    brand: 'Aradığın Var',
    category: 'Ekmek Sepeti',
    price: 200.0,
    colors: ['Açık Mavi'],
    stocks: [1],
    attributes: [
      {
        name: 'Renk',
        value: 'Açık Mavi',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00005TPJZF',
      },
    ],
    source: {
      productId: 'HBC00005TPJZE',
      url: 'https://www.hepsiburada.com/aradigin-var-dat-6-li-sosluk-lokumluk-drajelik-pm-HBC00005TPJZE',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/257/424-600/110000240520576.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV00005TPJZF',
    },
  },
  {
    id: 2008,
    code: 'HBCV00003ISPYT',
    title: 'Aradığın Var Kızılcahamam El Yapımı Tarhana 1 kg',
    description: 'Kızılcahamam usulü el yapımı tarhana; ilan gramajı 1 kg.',
    brand: 'Aradığın Var',
    category: 'Tarhana',
    price: 499.9,
    colors: ['Standart'],
    stocks: [1],
    attributes: [
      {
        name: 'Gramaj',
        value: '1 kg',
      },
      {
        name: 'Üretim',
        value: 'El Yapımı',
      },
      {
        name: 'Yöre',
        value: 'Kızılcahamam',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00003ISPYT',
      },
    ],
    source: {
      productId: 'HBC00003ISPYS',
      url: 'https://www.hepsiburada.com/aradigin-var-kizilcahamam-el-yapimi-tarhana-1-kg-pm-HBC00003ISPYS',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/339/424-600/110000345432146.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV00003ISPYT',
    },
  },
  {
    id: 2009,
    code: 'HBCV00004D4VOK',
    title: "Aradığın Var Saklama Kabı 3'lü Set",
    description:
      'Kiler ve dolap düzeninde kullanılabilen üçlü şeffaf saklama kabı seti. İlan metninde kapasiteler 2,1 L, 1,6 L ve üçüncü kap için 0,6 CL şeklinde listeleniyor.',
    brand: 'Aradığın Var',
    category: 'Saklama Kabı',
    price: 309.9,
    colors: ['Şeffaf'],
    stocks: [1],
    attributes: [
      {
        name: 'Set',
        value: "3'lü",
      },
      {
        name: 'Kapasite 1',
        value: '2,1 L',
      },
      {
        name: 'Kapasite 2',
        value: '1,6 L',
      },
      {
        name: 'Kapasite 3',
        value: '0,6 CL (ilan metni)',
      },
      {
        name: 'Gıda Temasına Uygun',
        value: 'Evet',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00004D4VOK',
      },
    ],
    source: {
      productId: 'HBC00004D4VOJ',
      url: 'https://www.hepsiburada.com/aradigin-var-saklama-kabi-3-lu-set-pm-HBC00004D4VOJ',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110000663985253.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV00004D4VOK',
    },
  },
  {
    id: 2010,
    code: 'HBC000058UQT8',
    title: 'Aradığın Var Premium Araç Yıkama Eldiveni',
    description:
      'Elastik bilek yapısına sahip araç yıkama eldiveni; ilan açıklamasında yüzeyde kalıntı bırakmadan temizlik amacıyla kullanıldığı belirtiliyor.',
    brand: 'Aradığın Var',
    category: 'Araç Yıkama Eldiveni',
    price: 449.9,
    colors: ['100 - Beyaz'],
    stocks: [1],
    attributes: [
      {
        name: 'Renk',
        value: '100 - Beyaz',
      },
      {
        name: 'Araç Markası',
        value: 'Suzuki',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
    ],
    source: {
      productId: 'HBC000058UQT8',
      url: 'https://www.hepsiburada.com/aradigin-var-premium-arac-yikama-eldiveni-pm-HBC000058UQT8',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/495/424-600/110000546021411.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
    },
  },
  {
    id: 2011,
    code: 'HBCV00002DBZ95',
    title: "Aradığın Var Dat 5'li Tornavida Seti Kontrol Kalemli",
    description:
      'Paslanmaz çelik beş parçalı tornavida seti; ilanda iki düz, iki yıldız tornavida ve bir kontrol kalemi bulunduğu belirtiliyor.',
    brand: 'Aradığın Var',
    category: 'Tornavida Seti',
    price: 449.9,
    colors: ['Gümüş'],
    stocks: [1],
    attributes: [
      {
        name: 'Renk',
        value: 'Gümüş',
      },
      {
        name: 'Ölçü',
        value: 'Standart',
      },
      {
        name: 'Türü',
        value: 'Tornavida Seti',
      },
      {
        name: 'Set İçeriği',
        value: '2 düz tornavida, 2 yıldız tornavida, 1 kontrol kalemi',
      },
      {
        name: 'Materyal',
        value: 'Paslanmaz Çelik',
      },
      {
        name: 'Stok Adedi',
        value: '5 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00002DBZ95',
      },
    ],
    source: {
      productId: 'HBC00002M7I7D',
      url: 'https://www.hepsiburada.com/aradigin-var-dat-6-li-sosluk-lokumluk-drajelik-pm-HBC00002M7I7D',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/230/424-600/110000212359249.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '5 adetten az',
      stockCode: 'HBCV00002DBZ95',
    },
  },
  {
    id: 2012,
    code: 'HBCV00004BY767',
    title: 'Bluetooth Radyolu 3 Ampullü Güneş Enerjili Aydınlatma Cihazı',
    description:
      'Kamp ve acil durum kullanımına yönelik, radyo ve güneş enerjisi desteği bulunan üç LED ampullü aydınlatma seti; ilanda ampuller 5 V / 3 W olarak belirtiliyor.',
    brand: 'Aradığın Var',
    category: 'Kamp Aydınlatması',
    price: 2549.9,
    colors: ['Siyah'],
    stocks: [1],
    attributes: [
      {
        name: 'Ampul Cinsi',
        value: 'LED',
      },
      {
        name: 'Şarj',
        value: 'Var',
      },
      {
        name: 'Fener Tipi',
        value: 'Kamp tipi El Fenerleri',
      },
      {
        name: 'Ampul Sayısı',
        value: '3',
      },
      {
        name: 'Ampul Gücü',
        value: '5 V / 3 W',
      },
      {
        name: 'Radyo',
        value: 'Var',
      },
      {
        name: 'Güneş Enerjisi',
        value: 'Var',
      },
      {
        name: 'Stok Adedi',
        value: '20 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00004BY767',
      },
    ],
    source: {
      productId: 'HBC00004BY766',
      url: 'https://www.hepsiburada.com/aradigin-var-radyolu-3-ampullu-gunes-enerjili-aydinlatma-cihazi-pm-HBC00004BY766',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110000738833202.jpg',
      ],
      sellerName: 'ARADIĞIN VAR',
      stockText: '20 adetten az',
      stockCode: 'HBCV00004BY767',
    },
  },
  {
    id: 2013,
    code: 'HBCV0000D7SXAJ',
    title:
      'Exenar Aux Bluetooth Ses Adaptörü İki Yönlü RX/TX Alıcı Verici Araç TV PC 3.5mm Jack',
    description:
      '3,5 mm AUX bağlantılı cihazları kablosuz kullanıma açan çift yönlü RX/TX adaptör. İlanda Bluetooth 5.4, yaklaşık 8–10 m kapalı alan menzili, 7 saate kadar kullanım, yaklaşık 2 saat şarj ve 200 saate kadar bekleme bilgileri yer alıyor.',
    brand: 'Exenar',
    category: 'Bluetooth Araç Kiti',
    price: 574.0,
    colors: ['Siyah'],
    stocks: [1],
    attributes: [
      {
        name: 'CE Uygunluk Sembolü',
        value: 'Ürün görselinde bulunuyor.',
      },
      {
        name: 'Özellik',
        value: 'Kablosuz',
      },
      {
        name: 'Menşei',
        value: 'CN - Çin Halk Cumhuriyeti',
      },
      {
        name: 'Bluetooth',
        value: '5.4',
      },
      {
        name: 'Modlar',
        value: 'RX / TX',
      },
      {
        name: 'Ses Bağlantısı',
        value: '3.5 mm AUX',
      },
      {
        name: 'Çalışma Süresi',
        value: '7 saate kadar',
      },
      {
        name: 'Şarj Süresi',
        value: 'Yaklaşık 2 saat',
      },
      {
        name: 'Bekleme Süresi',
        value: '200 saate kadar',
      },
      {
        name: 'Menzil',
        value: '8–10 metreye kadar',
      },
      {
        name: 'Stok Adedi',
        value: '1.000 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV0000D7SXAJ',
      },
    ],
    source: {
      productId: 'HBC0000D7SXAI',
      url: 'https://www.hepsiburada.com/aux-bluetooth-ses-adaptoru-iki-yonlu-rx-tx-alici-verici-arac-tv-televizyon-pc-bilgisayar-3-5mm-jack-pm-HBC0000D7SXAI',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001561329880.jpg',
      ],
      sellerName: 'Vizyonda',
      stockText: '1.000 adetten az',
      stockCode: 'HBCV0000D7SXAJ',
    },
  },
  {
    id: 2014,
    code: 'HBV0000187HS4',
    title:
      'Mcdodo CA-8700 Gri Bluetooth Araç Kiti Aux Dönüştürücü USB Bağlantı Tipi ile HD Ses Performansı',
    description:
      'Araç ses sistemini Bluetooth bağlantısına dönüştüren AUX/USB araç kiti. İlanda Wireless 5.1, eller serbest mikrofon, yaklaşık 10 m bağlantı mesafesi, 18 g ağırlık ve çinko alaşım gövde bilgileri bulunuyor.',
    brand: 'Mcdodo',
    category: 'Bluetooth Araç Kiti',
    price: 685.0,
    colors: ['Gri'],
    stocks: [1],
    attributes: [
      {
        name: 'Araç Montajı',
        value: 'Yok',
      },
      {
        name: 'Renk',
        value: 'Gri',
      },
      {
        name: 'Bağlantı Tipi',
        value: 'USB',
      },
      {
        name: 'İthalatçı/ Yetkili Temsilci/ İfa Hizmet Sağlayıcı',
        value: 'MCDODO',
      },
      {
        name: 'Bluetooth',
        value: '5.1',
      },
      {
        name: 'Menzil',
        value: '10 m',
      },
      {
        name: 'Ağırlık',
        value: '18 g',
      },
      {
        name: 'Gövde',
        value: 'Zinc Alloy',
      },
      {
        name: 'Garanti Süresi',
        value: '12 Ay',
      },
      {
        name: 'Menşei',
        value: 'CN - Çin Halk Cumhuriyeti',
      },
      {
        name: 'Stok Adedi',
        value: '10.000 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBV0000187HS4',
      },
    ],
    source: {
      productId: 'HB0000187HS3',
      url: 'https://www.hepsiburada.com/mcdodo-ca-8700-bluetooth-alici-aux-donusturucu-wireless-arac-kiti-gri-pm-HB0000187HS3',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001609982975.jpg',
      ],
      sellerName: 'ŞAFAK PAZARLAMA',
      stockText: '10.000 adetten az',
      stockCode: 'HBV0000187HS4',
    },
  },
  {
    id: 2015,
    code: 'HBCV00008PMXE1',
    title:
      'Maxgo 3128 Bluetooth Araç Kiti Aux Dönüştürücü USB Bağlantı Tipi ile Hifi Ses Performansı',
    description:
      'Araç ses sistemine Bluetooth bağlantısı kazandıran 3,5 mm stereo araç kiti. İlanda Wireless 5.1, kablosuz kullanım ve araç montajı desteği belirtiliyor.',
    brand: 'Maxgo',
    category: 'Bluetooth Araç Kiti',
    price: 455.61,
    colors: ['Gümüş'],
    stocks: [1],
    attributes: [
      {
        name: 'Bağlantı Tipi',
        value: '3.5 mm Stereo',
      },
      {
        name: 'Çift Telefon Desteği',
        value: 'Yok',
      },
      {
        name: 'Özellik',
        value: 'Kablosuz',
      },
      {
        name: 'Mikrofon Özelliği',
        value: '.',
      },
      {
        name: 'Araç Montajı',
        value: 'Var',
      },
      {
        name: 'Menşei',
        value: 'CN - Çin Halk Cumhuriyeti',
      },
      {
        name: 'Renk',
        value: 'Gümüş',
      },
      {
        name: 'Bluetooth',
        value: '5.1',
      },
      {
        name: 'Stok Adedi',
        value: '20 adetten az',
      },
      {
        name: 'Stok Kodu',
        value: 'HBCV00008PMXE1',
      },
    ],
    source: {
      productId: 'HBC00008PMXE0',
      url: 'https://www.hepsiburada.com/maxgo-3128-bluetooth-wireless-bt5-1-usb-to-3-5mm-arac-kiti-bluetooth-arac-ici-fm-transmitter-hifi-ses-destekli-pm-HBC00008PMXE0',
      capturedAt: '2026-08-31',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001782951363.jpg',
      ],
      sellerName: 'kablomarketim',
      stockText: '20 adetten az',
      stockCode: 'HBCV00008PMXE1',
    },
  },
];
