import type { ProductAnswerContext } from '../questions/product-answer-context.types';

type DemoCatalog = {
  category: string;
  description: string;
  color: string;
  price: number;
  sizes: Array<{ size: string; stock: number }>;
  attributes: ProductAnswerContext['product']['attributes'];
  sizeGuides?: ProductAnswerContext['product']['sizeGuides'];
};

export type LandingDemoProduct = {
  id: string;
  title: string;
  subtitle: string;
  art: 'jogger' | 'denim' | 'top' | 'dress' | 'jacket';
  highlights: string[];
  examples: string[];
  evidence: Array<{ id: string; label: string; value: string }>;
  catalog: DemoCatalog;
};

export const LANDING_DEMO_PRODUCTS: LandingDemoProduct[] = [
  {
    id: 'cotton-jogger',
    title: 'Pamuklu Jogger Pantolon',
    subtitle: 'Günlük giyimin rahat parçası',
    art: 'jogger',
    highlights: ['%100 pamuk', 'Rahat kalıp'],
    examples: ['44 beden var mı?', 'Yıkamada çeker mi?'],
    catalog: {
      category: 'Erkek Pantolon',
      description:
        'İnce pamuklu kumaşı ve rahat jogger kesimiyle günlük ve mevsimlik kullanıma uygun örnek pantolon.',
      color: 'Haki',
      price: 649.9,
      sizes: [
        { size: 'S', stock: 12 },
        { size: 'M', stock: 8 },
        { size: 'L', stock: 4 },
        { size: 'XL', stock: 0 },
      ],
      attributes: [
        { name: 'Materyal Bileşeni', value: '%100 pamuk' },
        { name: 'Kalıp', value: 'Jogger — eşofman formuna benzer rahat kesim' },
        { name: 'Kumaş Kalınlığı', value: 'İnce' },
        {
          name: 'Yıkama Talimatı',
          value: 'En fazla 30 °C hassas yıkama; tamburlu kurutma önerilmez',
        },
      ],
    },
    evidence: [
      { id: 'material', label: 'Materyal', value: '%100 pamuk.' },
      {
        id: 'fit',
        label: 'Kalıp',
        value: 'Rahat jogger kesim; beli lastikli ve bağcıklı, düz paça.',
      },
      { id: 'sizes', label: 'Beden seçenekleri', value: 'S, M, L, XL.' },
      {
        id: 'care',
        label: 'Bakım',
        value: 'En fazla 30 °C hassas yıkama; tamburlu kurutma önerilmez.',
      },
    ],
  },
  {
    id: 'stretch-denim',
    title: 'Esnek Denim Pantolon',
    subtitle: 'Hafif esneyen denim doku',
    art: 'denim',
    highlights: ['%2 elastan', '28–40 beden'],
    examples: ['44 yok mu?', 'Kumaşı esner mi?'],
    catalog: {
      category: 'Erkek Pantolon',
      description:
        'Orta kalınlıkta denim kumaştan üretilen, günlük ve mevsimlik kullanıma uygun regular fit örnek pantolon.',
      color: 'Lacivert',
      price: 799.9,
      sizes: [
        { size: '28', stock: 12 },
        { size: '30', stock: 0 },
        { size: '32', stock: 9 },
        { size: '34', stock: 7 },
        { size: '36', stock: 5 },
        { size: '38', stock: 3 },
        { size: '40', stock: 2 },
      ],
      attributes: [
        { name: 'Materyal Bileşeni', value: '%98 pamuk, %2 elastan denim' },
        { name: 'Kalıp', value: 'Regular fit, düz paça' },
        { name: 'Kumaş Kalınlığı', value: 'Orta' },
        { name: 'Yıkama Talimatı', value: 'En fazla 30 °C yıkama' },
      ],
      sizeGuides: [
        {
          id: 'denim-body-guide',
          sourceUrl: 'demo://size-guide/denim',
          normalizedText:
            'Örnek erkek alt giyim beden rehberi; boy ve kilo aralıkları yaklaşık öneri içindir.',
          confidence: 0.9,
          structuredData: {
            title: 'Örnek erkek alt giyim beden rehberi',
            audience: 'MEN',
            measurementBasis: 'BODY',
            unit: 'CM',
            headers: ['Beden', 'Boy', 'Kilo', 'Bel'],
            rows: [
              {
                label: '28',
                measurements: [
                  { name: 'Boy', value: '155-169' },
                  { name: 'Kilo', value: '48-57' },
                  { name: 'Bel', value: '72-76' },
                ],
              },
              {
                label: '30',
                measurements: [
                  { name: 'Boy', value: '165-179' },
                  { name: 'Kilo', value: '58-66' },
                  { name: 'Bel', value: '77-81' },
                ],
              },
              {
                label: '32',
                measurements: [
                  { name: 'Boy', value: '178-192' },
                  { name: 'Kilo', value: '67-75' },
                  { name: 'Bel', value: '82-86' },
                ],
              },
              {
                label: '34',
                measurements: [
                  { name: 'Boy', value: '175-192' },
                  { name: 'Kilo', value: '76-86' },
                  { name: 'Bel', value: '87-91' },
                ],
              },
              {
                label: '36',
                measurements: [
                  { name: 'Boy', value: '175-195' },
                  { name: 'Kilo', value: '87-98' },
                  { name: 'Bel', value: '92-96' },
                ],
              },
              {
                label: '38',
                measurements: [
                  { name: 'Boy', value: '175-198' },
                  { name: 'Kilo', value: '99-110' },
                  { name: 'Bel', value: '97-101' },
                ],
              },
              {
                label: '40',
                measurements: [
                  { name: 'Boy', value: '175-200' },
                  { name: 'Kilo', value: '111-123' },
                  { name: 'Bel', value: '102-106' },
                ],
              },
            ],
            notes: [
              'Boy-kilo eşleşmesi yaklaşık öneridir; bel ölçüsüyle kontrol edilmelidir.',
            ],
            confidence: 0.9,
          },
        },
      ],
    },
    evidence: [
      {
        id: 'material',
        label: 'Materyal',
        value: '%98 pamuk, %2 elastan denim.',
      },
      { id: 'fit', label: 'Kalıp', value: 'Regular fit, düz paça.' },
      {
        id: 'sizes',
        label: 'Listelenen bedenler',
        value: '28, 30, 32, 34, 36, 38 ve 40. 44 listelenmiyor.',
      },
      { id: 'care', label: 'Bakım', value: 'En fazla 30 °C yıkama.' },
    ],
  },
  {
    id: 'boxy-top',
    title: 'Boxy Fit Basic Atlet',
    subtitle: 'Yumuşak dokulu günlük model',
    art: 'top',
    highlights: ['%100 pamuk', 'Boxy fit'],
    examples: ['XL göğüs ölçüsü nedir?', 'Kalıbı bol mu?'],
    catalog: {
      category: 'Erkek Üst Giyim',
      description:
        'Boxy fit kesimli, yumuşak pamuklu örnek atlet; sıcak havalarda günlük kullanıma uygundur.',
      color: 'Kırık Beyaz',
      price: 349.9,
      sizes: [
        { size: 'XS', stock: 8 },
        { size: 'S', stock: 11 },
        { size: 'M', stock: 14 },
        { size: 'L', stock: 6 },
        { size: 'XL', stock: 5 },
        { size: '2XL', stock: 0 },
      ],
      attributes: [
        { name: 'Materyal Bileşeni', value: '%100 pamuk' },
        { name: 'Kalıp', value: 'Boxy fit — gövdesi geniş, rahat kesim' },
        { name: 'Kumaş Kalınlığı', value: 'İnce' },
        { name: 'Yıkama Talimatı', value: 'En fazla 30 °C hassas yıkama' },
      ],
      sizeGuides: [
        {
          id: 'top-garment-guide',
          sourceUrl: 'demo://size-guide/top',
          normalizedText:
            'Örnek ürün göğüs eni: XS 46 cm, S 48 cm, M 51 cm, L 54 cm, XL 58 cm, 2XL 62 cm. Düz zeminde tek yön ölçüm.',
          confidence: 1,
          structuredData: {
            title: 'Örnek erkek üst giyim ürün ölçüleri',
            audience: 'MEN',
            measurementBasis: 'GARMENT',
            unit: 'CM',
            headers: ['Beden', 'Ürün göğüs eni'],
            rows: [
              {
                label: 'XS',
                measurements: [{ name: 'Ürün göğüs eni', value: '46 cm' }],
              },
              {
                label: 'S',
                measurements: [{ name: 'Ürün göğüs eni', value: '48 cm' }],
              },
              {
                label: 'M',
                measurements: [{ name: 'Ürün göğüs eni', value: '51 cm' }],
              },
              {
                label: 'L',
                measurements: [{ name: 'Ürün göğüs eni', value: '54 cm' }],
              },
              {
                label: 'XL',
                measurements: [{ name: 'Ürün göğüs eni', value: '58 cm' }],
              },
              {
                label: '2XL',
                measurements: [{ name: 'Ürün göğüs eni', value: '62 cm' }],
              },
            ],
            notes: ['Ölçüler düz zeminde tek yönde alınmıştır.'],
            confidence: 1,
          },
        },
      ],
    },
    evidence: [
      { id: 'material', label: 'Materyal', value: '%100 pamuk.' },
      { id: 'fit', label: 'Kalıp', value: 'Boxy fit; gövdesi geniş kesim.' },
      { id: 'sizes', label: 'Bedenler', value: 'XS, S, M, L, XL, 2XL.' },
      {
        id: 'size-guide',
        label: 'Beden tablosu',
        value: 'XL için ürün göğüs eni 58 cm (düz zeminde tek yön ölçüm).',
      },
    ],
  },
  {
    id: 'summer-dress',
    title: 'Bağcıklı Yazlık Elbise',
    subtitle: 'Hafif, akışkan kumaş',
    art: 'dress',
    highlights: ['%100 viskon', '34–44 beden'],
    examples: ['Kumaşı ince mi?', 'Astarlı mı?'],
    catalog: {
      category: 'Kadın Elbise',
      description:
        'Hafif ve ince viskon kumaşlı, ayarlanabilir bel bağcığı bulunan yazlık örnek elbise.',
      color: 'Mint Yeşili',
      price: 899.9,
      sizes: [
        { size: '34', stock: 4 },
        { size: '36', stock: 7 },
        { size: '38', stock: 9 },
        { size: '40', stock: 5 },
        { size: '42', stock: 2 },
        { size: '44', stock: 0 },
      ],
      attributes: [
        { name: 'Materyal Bileşeni', value: '%100 viskon' },
        { name: 'Kalıp', value: 'Rahat kesim, ayarlanabilir bel bağı' },
        { name: 'Kumaş Kalınlığı', value: 'İnce' },
        { name: 'Astar', value: 'Astarlı' },
        { name: 'Yıkama Talimatı', value: 'En fazla 30 °C hassas yıkama' },
      ],
    },
    evidence: [
      { id: 'material', label: 'Materyal', value: '%100 viskon.' },
      {
        id: 'fit',
        label: 'Kalıp',
        value: 'Rahat kesim, ayarlanabilir bel bağı.',
      },
      { id: 'sizes', label: 'Bedenler', value: '34, 36, 38, 40, 42, 44.' },
      { id: 'care', label: 'Bakım', value: 'En fazla 30 °C hassas yıkama.' },
    ],
  },
  {
    id: 'light-jacket',
    title: 'Hafif Mevsimlik Ceket',
    subtitle: 'Günlük katman için hafif yapı',
    art: 'jacket',
    highlights: ['%100 polyester', 'Regular fit'],
    examples: ['Su geçirir mi?', '30 derecede giyilir mi?'],
    catalog: {
      category: 'Unisex Ceket',
      description:
        'Hafif mevsimlik örnek ceket; günlük kullanım ve serin havalarda katmanlı giyim için tasarlanmıştır.',
      color: 'Taş Rengi',
      price: 1099.9,
      sizes: [
        { size: 'S', stock: 6 },
        { size: 'M', stock: 10 },
        { size: 'L', stock: 8 },
        { size: 'XL', stock: 3 },
      ],
      attributes: [
        { name: 'Materyal Bileşeni', value: '%100 polyester' },
        { name: 'Kalıp', value: 'Regular fit' },
        { name: 'Kumaş Kalınlığı', value: 'İnce' },
        {
          name: 'Su Geçirmezlik',
          value: 'Su geçirmez değildir; yoğun yağmur için önerilmez',
        },
        { name: 'Yıkama Talimatı', value: 'En fazla 30 °C hassas yıkama' },
      ],
    },
    evidence: [
      { id: 'material', label: 'Materyal', value: '%100 polyester.' },
      {
        id: 'fit',
        label: 'Kalıp',
        value: 'Regular fit, hafif mevsimlik yapı.',
      },
      { id: 'sizes', label: 'Bedenler', value: 'S, M, L, XL.' },
      {
        id: 'properties',
        label: 'Su geçirmezlik',
        value: 'Su geçirmez değildir; yoğun yağmur için önerilmez.',
      },
    ],
  },
];

export const LANDING_DEMO_STORE_EVIDENCE: ProductAnswerContext['evidence'] = [
  {
    id: 'store-shipping-policy',
    fact: 'SHIPPING',
    label: 'Örnek mağaza kargo bilgisi',
    value:
      'Siparişler ortalama 2 iş günü içinde Aras Kargo veya HepsiJET firmasına teslim edilir. Kesin teslim günü teslimat adresine ve taşıyıcıya göre değişir.',
    source: 'STORE_KNOWLEDGE',
  },
  {
    id: 'store-return-policy',
    fact: 'RETURN',
    label: 'Örnek mağaza iade politikası',
    value:
      'Teslimden sonraki 14 gün içinde kullanılmamış, yıkanmamış ve etiketi üzerinde olan ürünler için iade talebi açılabilir.',
    source: 'STORE_KNOWLEDGE',
  },
  {
    id: 'store-exchange-policy',
    fact: 'EXCHANGE',
    label: 'Örnek mağaza değişim politikası',
    value:
      'Beden veya renk değişimi için teslimden sonraki 14 gün içinde talep oluşturulabilir; istenen varyantın bulunabilirliği ayrıca kontrol edilir.',
    source: 'STORE_KNOWLEDGE',
  },
  {
    id: 'store-warranty-policy',
    fact: 'WARRANTY',
    label: 'Örnek mağaza ürün desteği',
    value:
      'Üretim kaynaklı bir sorun yaşanırsa sipariş bilgisi ve ürün fotoğrafıyla destek talebi oluşturulabilir; sonuç incelemeden sonra bildirilir.',
    source: 'STORE_KNOWLEDGE',
  },
];
