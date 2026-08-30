import { Injectable } from '@nestjs/common';
import type {
  ConnectorContext,
  InventoryBatch,
  NormalizedProduct,
  ProductBatch,
  ProviderCredentials,
} from './catalog-connector';

const TEST_PRODUCT_IMAGE_URL =
  'https://cdn.dsmcdn.com/mnresize/420/620/ty1000441/product/media/images/prod/PIM/20260820/13/c81dfbf2-a9fa-48b2-8445-c0d16249ea71/1_org_zoom.jpg';

export const MOCK_PRODUCTS_PER_PROVIDER = 12;

type MockProductSeed = {
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
}

function createTrendyolProducts(): ProductBatch['products'] {
  return TRENDYOL_PRODUCT_SEEDS.map((seed) =>
    createMockProduct('trendyol', seed),
  );
}

function createHepsiburadaProducts(): ProductBatch['products'] {
  return HEPSIBURADA_PRODUCT_SEEDS.map((seed) =>
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
  const variants = seed.colors.flatMap((color) =>
    sizes.map((size) => ({ color, size })),
  );

  return {
    externalId: `${externalPrefix}-${seed.id}`,
    externalUrl:
      provider === 'trendyol'
        ? 'https://www.trendyol.com/'
        : 'https://www.hepsiburada.com/',
    title: seed.title,
    description,
    brand: seed.brand,
    category: seed.category,
    attributes,
    images: [TEST_PRODUCT_IMAGE_URL],
    variants: variants.map((variant, index) => ({
      externalId: `${providerPrefix}-variant-${seed.id}-${index + 1}`,
      title: [variant.color, variant.size].filter(Boolean).join(' / '),
      sku: `${seed.code}-${seed.id}-${String(index + 1).padStart(2, '0')}`,
      barcode: `869${provider === 'trendyol' ? '1' : '2'}${String(seed.id).padStart(4, '0')}${String(index + 1).padStart(5, '0')}`,
      color: variant.color,
      size: variant.size,
      price: seed.price,
      currency: 'TRY',
      stock: seed.stocks[index % seed.stocks.length],
    })),
    rawPayload: {
      fixture: true,
      provider,
      contentId: `${externalPrefix}-${seed.id}`,
      title: seed.title,
      description,
      attributes,
      seller: {
        name:
          provider === 'trendyol' ? 'North Official Store' : 'North Mağazası',
      },
      commercialInfo: {
        freeReturnDays: 15,
        maximumOrderQuantity: 10,
        sellerDeterminesPrice: true,
      },
    },
  };
}

function createMarketplaceDescription(seed: MockProductSeed) {
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

function createMarketplaceAttributes(seed: MockProductSeed) {
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
    {
      name: 'Kutu Durumu',
      value: /(ayakkabı|bot|loafer|sandalet|terlik)/i.test(seed.category)
        ? 'Kutulu'
        : 'Kutu yok',
    },
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
    return 'Su ile yıkamayınız. Gerektiğinde hafif nemli ve yumuşak bir bezle temizleyiniz. Kimyasal temizleyici ve ağartıcı kullanmayınız. Doğrudan güneş ışığına ve yüksek sıcaklığa uzun süre maruz bırakmayınız.';
  }

  if (/(çanta|valiz|cüzdan)/i.test(seed.category)) {
    return 'Nemli ve yumuşak bir bezle nazikçe temizleyiniz. Makinede yıkamayınız. Kullanmadığınız zamanlarda kuru ve temiz bir ortamda muhafaza ediniz.';
  }

  if (/(ayakkabı|bot|loafer|sandalet|terlik)/i.test(seed.category)) {
    return 'Yüzeyi yumuşak bir bezle temizleyiniz. Makinede yıkamayınız. Islak bırakmayınız ve doğrudan ısı kaynağında kurutmayınız.';
  }

  return 'Ürün etiketindeki bakım talimatlarına uyunuz. Benzer renklerle yıkayınız; ağartıcı kullanmayınız ve doğrudan yüksek ısıya maruz bırakmayınız.';
}

const TRENDYOL_PRODUCT_SEEDS: MockProductSeed[] = [
  {
    id: 1001,
    code: 'NST-TSH',
    title: 'Oversize Pamuklu Tişört',
    description: 'Yumuşak dokulu, bisiklet yaka oversize pamuklu tişört.',
    brand: 'North Studio',
    category: 'Tişört',
    price: 649.9,
    colors: ['Siyah', 'Ekru'],
    sizes: ['S', 'M', 'L'],
    stocks: [8, 0, 5, 3, 7, 2],
    attributes: [
      { name: 'Kalıp', value: 'Oversize' },
      { name: 'Materyal', value: '%100 Pamuk' },
    ],
  },
  {
    id: 1002,
    code: 'NST-SHT',
    title: 'Keten Karışımlı Gömlek',
    description: 'Nefes alan keten karışımlı regular fit uzun kollu gömlek.',
    brand: 'North Studio',
    category: 'Gömlek',
    price: 1099,
    colors: ['Mavi', 'Beyaz'],
    sizes: ['M', 'L', 'XL'],
    stocks: [3, 6, 0, 4, 2, 1],
    attributes: [
      { name: 'Kalıp', value: 'Regular Fit' },
      { name: 'Kumaş', value: 'Keten Karışımlı' },
    ],
  },
  {
    id: 1003,
    code: 'NST-JNS',
    title: 'Yüksek Bel Straight Jean',
    description: 'Esnek olmayan denim kumaştan yüksek bel düz paça jean.',
    brand: 'North Studio',
    category: 'Jean',
    price: 1399.9,
    colors: ['Açık Mavi', 'Füme'],
    sizes: ['26', '28', '30'],
    stocks: [5, 2, 0, 6, 4, 3],
    attributes: [
      { name: 'Bel', value: 'Yüksek Bel' },
      { name: 'Paça', value: 'Straight' },
    ],
  },
  {
    id: 1004,
    code: 'NST-SWT',
    title: 'Fermuarlı Basic Sweatshirt',
    description: 'İçi yumuşak dokulu, fermuarlı ve kapüşonlu sweatshirt.',
    brand: 'North Studio',
    category: 'Sweatshirt',
    price: 1249,
    colors: ['Gri Melanj', 'Lacivert'],
    sizes: ['S', 'M', 'L'],
    stocks: [9, 6, 1, 0, 4, 7],
    attributes: [
      { name: 'Yaka', value: 'Kapüşonlu' },
      { name: 'Kalınlık', value: 'Orta' },
    ],
  },
  {
    id: 1005,
    code: 'NCR-BAG',
    title: 'Günlük Kanvas Omuz Çantası',
    description: 'Ayarlanabilir askılı, fermuarlı ve iç cepli kanvas çanta.',
    brand: 'North Carry',
    category: 'Omuz Çantası',
    price: 899.9,
    colors: ['Haki', 'Siyah', 'Bej'],
    stocks: [12, 5, 0],
    attributes: [
      { name: 'Materyal', value: 'Kanvas' },
      { name: 'Ölçü', value: '28 x 20 cm' },
    ],
  },
  {
    id: 1006,
    code: 'NST-DRS',
    title: 'Midi Boy Kemerli Elbise',
    description: 'Belden kemerli, dökümlü kumaşlı ve astarlı midi elbise.',
    brand: 'North Studio',
    category: 'Elbise',
    price: 1699,
    colors: ['Bordo', 'Siyah'],
    sizes: ['S', 'M', 'L'],
    stocks: [2, 4, 1, 5, 0, 3],
    attributes: [
      { name: 'Boy', value: 'Midi' },
      { name: 'Astar', value: 'Var' },
    ],
  },
  {
    id: 1007,
    code: 'NST-CRD',
    title: 'Düğmeli Triko Hırka',
    description: 'Yumuşak dokulu, düğmeli ve rahat kesim triko hırka.',
    brand: 'North Studio',
    category: 'Hırka',
    price: 1149.9,
    colors: ['Taş', 'Kahverengi'],
    sizes: ['S/M', 'L/XL'],
    stocks: [6, 2, 4, 0],
    attributes: [
      { name: 'Dokuma', value: 'Triko' },
      { name: 'Kalıp', value: 'Rahat' },
    ],
  },
  {
    id: 1008,
    code: 'NST-TRS',
    title: 'Pileli Palazzo Pantolon',
    description: 'Yüksek belli, pile detaylı ve geniş paçalı palazzo pantolon.',
    brand: 'North Studio',
    category: 'Pantolon',
    price: 1299,
    colors: ['Siyah', 'Vizon'],
    sizes: ['36', '38', '40'],
    stocks: [4, 7, 2, 3, 0, 5],
    attributes: [
      { name: 'Paça', value: 'Geniş Paça' },
      { name: 'Bel', value: 'Yüksek Bel' },
    ],
  },
  {
    id: 1009,
    code: 'NST-JKT',
    title: 'Su İtici İnce Mont',
    description: 'Hafif, kapüşonlu ve su itici yüzeye sahip mevsimlik mont.',
    brand: 'North Studio',
    category: 'Mont',
    price: 2199.9,
    colors: ['Siyah', 'Haki'],
    sizes: ['M', 'L', 'XL'],
    stocks: [3, 1, 0, 5, 2, 4],
    attributes: [
      { name: 'Özellik', value: 'Su İtici' },
      { name: 'Mevsim', value: 'Bahar' },
    ],
  },
  {
    id: 1010,
    code: 'NST-SKR',
    title: 'Saten Görünümlü Midi Etek',
    description: 'Akışkan dokulu, lastikli belli saten görünümlü midi etek.',
    brand: 'North Studio',
    category: 'Etek',
    price: 999,
    colors: ['Şampanya', 'Siyah'],
    sizes: ['S', 'M', 'L'],
    stocks: [7, 5, 2, 4, 1, 0],
    attributes: [
      { name: 'Kumaş', value: 'Saten Görünümlü' },
      { name: 'Bel', value: 'Lastikli' },
    ],
  },
  {
    id: 1011,
    code: 'NST-PLO',
    title: 'Polo Yaka Piqué Tişört',
    description: 'Nefes alan piqué kumaştan slim fit polo yaka tişört.',
    brand: 'North Studio',
    category: 'Polo Tişört',
    price: 799.9,
    colors: ['Beyaz', 'Lacivert'],
    sizes: ['M', 'L', 'XL'],
    stocks: [8, 6, 3, 5, 0, 2],
    attributes: [
      { name: 'Kalıp', value: 'Slim Fit' },
      { name: 'Kumaş', value: 'Piqué' },
    ],
  },
  {
    id: 1012,
    code: 'NST-BLT',
    title: 'Klasik Tokalı Günlük Kemer',
    description: 'Şık toka detaylı, klasik tasarımlı poliüretan unisex kemer.',
    brand: 'North Studio',
    category: 'Kemer',
    price: 749,
    colors: ['Siyah', 'Taba'],
    sizes: ['90 cm', '100 cm', '110 cm'],
    stocks: [10, 7, 4, 8, 3, 0],
    attributes: [
      { name: 'Materyal', value: 'Poliüretan' },
      { name: 'Materyal Bileşeni', value: '%100 Poliüretan' },
      { name: 'Cinsiyet', value: 'Unisex' },
    ],
  },
];

const HEPSIBURADA_PRODUCT_SEEDS: MockProductSeed[] = [
  {
    id: 2001,
    code: 'NSS-SNK',
    title: 'Günlük Sneaker',
    description: 'Hafif tabanlı, nefes alan günlük kullanım sneaker modeli.',
    brand: 'North Steps',
    category: 'Sneaker',
    price: 1899.9,
    colors: ['Beyaz', 'Siyah'],
    sizes: ['40', '41', '42'],
    stocks: [4, 2, 0, 6, 3, 7],
    attributes: [
      { name: 'Dış Materyal', value: 'Suni Deri' },
      { name: 'Taban', value: 'Kauçuk' },
    ],
  },
  {
    id: 2002,
    code: 'NCR-BPK',
    title: 'Minimal Sırt Çantası',
    description:
      'Günlük kullanım için suya dayanıklı 18 litrelik sırt çantası.',
    brand: 'North Carry',
    category: 'Sırt Çantası',
    price: 1299,
    colors: ['Antrasit', 'Lacivert', 'Haki'],
    stocks: [9, 5, 0],
    attributes: [
      { name: 'Hacim', value: '18 L' },
      { name: 'Materyal', value: 'Polyester' },
    ],
  },
  {
    id: 2003,
    code: 'NSS-RUN',
    title: 'Air Flex Koşu Ayakkabısı',
    description: 'Darbe emici tabanlı, hafif ve nefes alan koşu ayakkabısı.',
    brand: 'North Steps',
    category: 'Koşu Ayakkabısı',
    price: 2399.9,
    colors: ['Siyah', 'Gri'],
    sizes: ['39', '40', '41', '42'],
    stocks: [3, 5, 2, 0, 4, 1, 6, 2],
    attributes: [
      { name: 'Taban', value: 'Darbe Emici' },
      { name: 'Kullanım', value: 'Koşu' },
    ],
  },
  {
    id: 2004,
    code: 'NCR-LPT',
    title: '15.6 İnç Laptop Çantası',
    description: 'Darbe korumalı, omuz askılı ve su itici laptop çantası.',
    brand: 'North Carry',
    category: 'Laptop Çantası',
    price: 1099,
    colors: ['Siyah', 'Gri'],
    stocks: [11, 4],
    attributes: [
      { name: 'Uyumluluk', value: '15.6 İnç' },
      { name: 'Koruma', value: 'Darbe Emici' },
    ],
  },
  {
    id: 2005,
    code: 'NSS-BOT',
    title: 'Su Geçirmez Outdoor Bot',
    description: 'Kaymaz tabanlı, sıcak astarlı ve su geçirmez outdoor bot.',
    brand: 'North Steps',
    category: 'Outdoor Bot',
    price: 2899,
    colors: ['Kahverengi', 'Siyah'],
    sizes: ['40', '41', '42', '43'],
    stocks: [2, 4, 0, 1, 5, 3, 2, 0],
    attributes: [
      { name: 'Özellik', value: 'Su Geçirmez' },
      { name: 'Taban', value: 'Kaymaz' },
    ],
  },
  {
    id: 2006,
    code: 'NCR-WLT',
    title: 'RFID Korumalı Deri Cüzdan',
    description: 'Kartları temassız okumaya karşı koruyan ince deri cüzdan.',
    brand: 'North Carry',
    category: 'Cüzdan',
    price: 849.9,
    colors: ['Siyah', 'Taba'],
    stocks: [8, 6],
    attributes: [
      { name: 'Koruma', value: 'RFID' },
      { name: 'Materyal', value: 'Deri' },
    ],
  },
  {
    id: 2007,
    code: 'NSS-SND',
    title: 'Ortopedik Günlük Sandalet',
    description: 'Ayarlanabilir bantlı ve anatomik tabanlı günlük sandalet.',
    brand: 'North Steps',
    category: 'Sandalet',
    price: 1499,
    colors: ['Bej', 'Siyah'],
    sizes: ['37', '38', '39', '40'],
    stocks: [4, 3, 6, 1, 2, 0, 5, 3],
    attributes: [
      { name: 'Taban', value: 'Anatomik' },
      { name: 'Bant', value: 'Ayarlanabilir' },
    ],
  },
  {
    id: 2008,
    code: 'NCR-DFF',
    title: 'Kabin Boy Spor Çantası',
    description: 'Ayakkabı bölmeli, kabin ölçülerine uygun spor çantası.',
    brand: 'North Carry',
    category: 'Spor Çantası',
    price: 1399.9,
    colors: ['Siyah', 'Haki'],
    stocks: [7, 2],
    attributes: [
      { name: 'Hacim', value: '35 L' },
      { name: 'Bölme', value: 'Ayakkabı Bölmeli' },
    ],
  },
  {
    id: 2009,
    code: 'NSS-LOF',
    title: 'Hakiki Deri Loafer',
    description: 'Esnek tabanlı, klasik görünümlü hakiki deri loafer.',
    brand: 'North Steps',
    category: 'Loafer',
    price: 2499,
    colors: ['Siyah', 'Taba'],
    sizes: ['40', '41', '42', '43'],
    stocks: [3, 1, 4, 2, 5, 0, 3, 1],
    attributes: [
      { name: 'Materyal', value: 'Hakiki Deri' },
      { name: 'Taban', value: 'Esnek' },
    ],
  },
  {
    id: 2010,
    code: 'NCR-TRV',
    title: 'Sert Kabuk Kabin Valizi',
    description: 'Dört tekerlekli, şifreli ve genişleyebilir kabin valizi.',
    brand: 'North Carry',
    category: 'Valiz',
    price: 3199.9,
    colors: ['Antrasit', 'Şampanya'],
    stocks: [4, 2],
    attributes: [
      { name: 'Boyut', value: 'Kabin Boy' },
      { name: 'Kilit', value: 'Şifreli' },
    ],
  },
  {
    id: 2011,
    code: 'NSS-SLP',
    title: 'Yumuşak Taban Ev Terliği',
    description: 'Kaymaz ve yumuşak tabanlı, hafif ev terliği.',
    brand: 'North Steps',
    category: 'Ev Terliği',
    price: 699.9,
    colors: ['Gri', 'Pudra'],
    sizes: ['36/37', '38/39', '40/41'],
    stocks: [9, 7, 3, 8, 0, 4],
    attributes: [
      { name: 'Taban', value: 'Kaymaz' },
      { name: 'Kullanım', value: 'Ev' },
    ],
  },
  {
    id: 2012,
    code: 'NCR-BEL',
    title: 'Ayarlanabilir Bel Çantası',
    description: 'Çok gözlü, hafif ve ayarlanabilir askılı bel çantası.',
    brand: 'North Carry',
    category: 'Bel Çantası',
    price: 749,
    colors: ['Siyah', 'Haki', 'Turuncu'],
    stocks: [10, 5, 2],
    attributes: [
      { name: 'Bölme', value: '3 Gözlü' },
      { name: 'Askı', value: 'Ayarlanabilir' },
    ],
  },
];
