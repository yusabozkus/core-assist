import type { ProviderManifest } from './catalog-connector';

export const PROVIDER_MANIFESTS: ProviderManifest[] = [
  {
    key: 'trendyol',
    name: 'Trendyol',
    type: 'COMMERCE',
    image: '/merchants/trendyol.webp',
    description: 'Ürün ve varyant kataloğunuzu Trendyol mağazanızdan alın.',
    capabilities: ['CATALOG_READ', 'INVENTORY_READ'],
    environments: ['SANDBOX', 'PRODUCTION'],
    credentialFields: [
      {
        key: 'supplierId',
        label: 'Satıcı ID',
        type: 'text',
        placeholder: 'Örn. 123456',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Trendyol API Key',
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        placeholder: 'Trendyol API Secret',
      },
    ],
  },
  {
    key: 'hepsiburada',
    name: 'Hepsiburada',
    type: 'COMMERCE',
    image: '/merchants/hepsiburada.webp',
    description: 'Merchant listing verilerinizi CoreAssist kataloğuna aktarın.',
    capabilities: ['CATALOG_READ', 'INVENTORY_READ'],
    environments: ['SANDBOX', 'PRODUCTION'],
    credentialFields: [
      {
        key: 'merchantId',
        label: 'Merchant ID',
        type: 'text',
        placeholder: 'Hepsiburada Merchant ID',
      },
      {
        key: 'developerUser',
        label: 'Developer User',
        type: 'text',
        placeholder: 'Entegrasyon kullanıcı adı',
      },
      {
        key: 'serviceKey',
        label: 'Servis anahtarı',
        type: 'password',
        placeholder: 'Hepsiburada servis anahtarı',
      },
    ],
  },
];
