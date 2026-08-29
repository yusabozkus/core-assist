import { Injectable } from '@nestjs/common';
import type {
  ConnectorContext,
  ProductBatch,
  ProviderCredentials,
} from './catalog-connector';

const TEST_PRODUCT_IMAGE_URL =
  'https://cdn.dsmcdn.com/mnresize/420/620/ty1000441/product/media/images/prod/PIM/20260820/13/c81dfbf2-a9fa-48b2-8445-c0d16249ea71/1_org_zoom.jpg';

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
}

function createTrendyolProducts(): ProductBatch['products'] {
  return [
    {
      externalId: 'ty-content-1001',
      externalUrl: 'https://www.trendyol.com/',
      title: 'Oversize Pamuklu Tişört',
      description: 'Yumuşak dokulu, bisiklet yaka oversize tişört.',
      brand: 'North Studio',
      category: 'Tişört',
      attributes: [
        { name: 'Kalıp', value: 'Oversize' },
        { name: 'Materyal', value: '%100 Pamuk' },
      ],
      images: [TEST_PRODUCT_IMAGE_URL],
      variants: [
        {
          title: 'Siyah / S',
          sku: 'NST-TSH-BLK-S',
          barcode: '869000100001',
          color: 'Siyah',
          size: 'S',
          price: 649.9,
          currency: 'TRY',
          stock: 8,
        },
        {
          title: 'Siyah / M',
          sku: 'NST-TSH-BLK-M',
          barcode: '869000100002',
          color: 'Siyah',
          size: 'M',
          price: 649.9,
          currency: 'TRY',
          stock: 0,
        },
        {
          title: 'Ekru / M',
          sku: 'NST-TSH-ECR-M',
          barcode: '869000100003',
          color: 'Ekru',
          size: 'M',
          price: 649.9,
          currency: 'TRY',
          stock: 5,
        },
      ],
      rawPayload: { fixture: true, provider: 'trendyol' },
    },
    {
      externalId: 'ty-content-1002',
      title: 'Keten Karışımlı Gömlek',
      description: 'Nefes alan keten karışımlı regular fit gömlek.',
      brand: 'North Studio',
      category: 'Gömlek',
      attributes: [
        { name: 'Kalıp', value: 'Regular Fit' },
        { name: 'Kol Tipi', value: 'Uzun Kol' },
      ],
      images: [TEST_PRODUCT_IMAGE_URL],
      variants: [
        {
          title: 'Mavi / M',
          sku: 'NST-SHT-BLU-M',
          color: 'Mavi',
          size: 'M',
          price: 1099,
          currency: 'TRY',
          stock: 3,
        },
        {
          title: 'Mavi / L',
          sku: 'NST-SHT-BLU-L',
          color: 'Mavi',
          size: 'L',
          price: 1099,
          currency: 'TRY',
          stock: 6,
        },
      ],
      rawPayload: { fixture: true, provider: 'trendyol' },
    },
  ];
}

function createHepsiburadaProducts(): ProductBatch['products'] {
  return [
    {
      externalId: 'hb-listing-2001',
      externalUrl: 'https://www.hepsiburada.com/',
      title: 'Günlük Sneaker',
      description: 'Hafif tabanlı günlük kullanım sneaker modeli.',
      brand: 'North Steps',
      category: 'Sneaker',
      attributes: [
        { name: 'Dış Materyal', value: 'Suni Deri' },
        { name: 'Taban', value: 'Kauçuk' },
      ],
      images: [TEST_PRODUCT_IMAGE_URL],
      variants: [
        {
          title: 'Beyaz / 40',
          sku: 'NSS-SNK-WHT-40',
          barcode: '869000200001',
          color: 'Beyaz',
          size: '40',
          price: 1899.9,
          currency: 'TRY',
          stock: 4,
        },
        {
          title: 'Beyaz / 41',
          sku: 'NSS-SNK-WHT-41',
          barcode: '869000200002',
          color: 'Beyaz',
          size: '41',
          price: 1899.9,
          currency: 'TRY',
          stock: 2,
        },
        {
          title: 'Siyah / 42',
          sku: 'NSS-SNK-BLK-42',
          barcode: '869000200003',
          color: 'Siyah',
          size: '42',
          price: 1949.9,
          currency: 'TRY',
          stock: 7,
        },
      ],
      rawPayload: { fixture: true, provider: 'hepsiburada' },
    },
    {
      externalId: 'hb-listing-2002',
      title: 'Minimal Sırt Çantası',
      description: 'Günlük kullanım için suya dayanıklı sırt çantası.',
      brand: 'North Carry',
      category: 'Sırt Çantası',
      attributes: [
        { name: 'Hacim', value: '18 L' },
        { name: 'Materyal', value: 'Polyester' },
      ],
      images: [TEST_PRODUCT_IMAGE_URL],
      variants: [
        {
          title: 'Antrasit',
          sku: 'NCR-BAG-ANT',
          color: 'Antrasit',
          price: 1299,
          currency: 'TRY',
          stock: 9,
        },
      ],
      rawPayload: { fixture: true, provider: 'hepsiburada' },
    },
  ];
}
