import type { MockProductSeed } from '../mock-catalog.connector';

// A source-verified product kept separately from the refreshed 30-item catalog.
// Its public question page supplies several distinct teach-and-reuse examples.
export const HEPSIBURADA_QUESTION_PRODUCT_SEEDS: MockProductSeed[] = [
  {
    id: 2031,
    code: 'D8022AXNS',
    title:
      "Regular Fit 2'li Takım Sweatshirt Beli Lastikli Jogger Eşofman Altı D8022AXNS",
    description:
      "Regular Fit 2'li kalın kumaş takım. Pamuk 66%, Poliester 34%. Ürün kodu: D8022AXNS.",
    brand: 'DeFacto',
    category: 'Kadın Alt Üst Takım',
    price: 909.07,
    colors: ['Gri-GR4'],
    sizes: ['XS', 'S', 'M', '2XL'],
    stocks: [1, 1, 1, 1],
    attributes: [
      { name: 'Cinsiyet', value: 'Kadın' },
      { name: 'Kalıp', value: 'Regular Fit' },
      { name: 'Kumaş Tipi', value: 'Pamuk - Polyester' },
      { name: 'Parça Sayısı', value: '2 Parça' },
      { name: 'Paça Tipi', value: 'Lastikli Paça' },
      { name: 'Stil', value: 'Günlük' },
    ],
    source: {
      productId: 'HBCV00008J0E0V',
      url: 'https://www.hepsiburada.com/defacto-regular-fit-2-li-takim-sweatshirt-beli-lastikli-jogger-esofman-alti-d8022axns-p-HBCV00008J0E0V',
      capturedAt: '2026-09-28',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001313944865.jpg',
      ],
      productCode: 'D8022AXNS',
      stockCode: 'HBCV00008J0E0V',
    },
  },
];
