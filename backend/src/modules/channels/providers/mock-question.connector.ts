import { Injectable } from '@nestjs/common';
import type { ConnectorContext } from './catalog-connector';
import { HEPSIBURADA_DEFACTO_PRODUCT_SEEDS } from './fixtures/hepsiburada-defacto-product-seeds';
import { TRENDYOL_DEFACTO_PRODUCT_SEEDS } from './fixtures/trendyol-defacto-product-seeds';
import type { MockProductSeed } from './mock-catalog.connector';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
} from './question-connector';

export const MOCK_TRENDYOL_QUESTIONS = 30;
export const MOCK_HEPSIBURADA_QUESTIONS = 30;
export const MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER = 1;

type MockQuestionSeed = {
  productId: number;
  customerName: string;
  text: string;
};

const CUSTOMER_NAMES = [
  'Mert A.',
  'Emre K.',
  'Burak T.',
  'Kaan Y.',
  'Onur D.',
  'Tolga E.',
  'Serkan B.',
  'Arda C.',
  'Umut N.',
  'Hakan S.',
  'Can O.',
  'Furkan Ş.',
  'Yasin G.',
  'Oğuz V.',
  'Kerem P.',
  'Barış M.',
  'Ali R.',
  'Sinan F.',
  'Cem İ.',
  'Eren L.',
  'Berk H.',
  'Ömer A.',
  'Batuhan T.',
  'Volkan K.',
  'Eray D.',
  'Murat Y.',
  'Gökhan E.',
  'Ahmet C.',
  'Levent B.',
  'Tayfun N.',
] as const;

@Injectable()
export class MockQuestionConnector {
  fetchProductQuestions(
    providerKey: string,
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    void context;

    if (options.cursor) return Promise.resolve({ questions: [] });

    return Promise.resolve({
      questions: createMockQuestions(providerKey, options.createdAfter),
    });
  }

  sendProductQuestionAnswer(
    providerKey: string,
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult> {
    void context;
    void answer;
    return Promise.resolve({
      externalAnswerId: `${providerKey}-answer-${externalQuestionId}`,
      answeredAt: new Date(),
    });
  }
}

function createMockQuestions(
  providerKey: string,
  createdAfter: Date,
): ProductQuestionBatch['questions'] {
  const isHepsiburada = providerKey === 'hepsiburada';
  const products = isHepsiburada
    ? HEPSIBURADA_DEFACTO_PRODUCT_SEEDS
    : TRENDYOL_DEFACTO_PRODUCT_SEEDS;
  const seeds = createQuestionSeeds(products);
  const questionPrefix = isHepsiburada ? 'hb-question' : 'ty-question';
  const productPrefix = isHepsiburada ? 'hb-listing' : 'ty-content';
  const customerPrefix = isHepsiburada ? 'hb-customer' : 'ty-customer';
  const questionStart = isHepsiburada ? 7001 : 5001;

  const currentQuestions = seeds.map((seed, index) => ({
    externalId: `${questionPrefix}-${questionStart + index}`,
    externalProductId: `${productPrefix}-${resolveExternalProductId(seed.productId, products)}`,
    externalCustomerId: `${customerPrefix}-${100 + index}`,
    customerName: seed.customerName,
    text: seed.text,
    createdAt: afterConnection(createdAfter, index + 1),
    rawPayload: { fixture: true, provider: providerKey },
  }));

  return [
    ...currentQuestions,
    {
      externalId: `${questionPrefix}-historical`,
      externalProductId: `${productPrefix}-${resolveExternalProductId(seeds[0].productId, products)}`,
      text: 'Bu soru bağlantı kurulmadan önce gönderildi.',
      createdAt: new Date(createdAfter.getTime() - 60 * 60_000),
      rawPayload: { fixture: true, historical: true, provider: providerKey },
    },
  ];
}

function createQuestionSeeds(products: MockProductSeed[]): MockQuestionSeed[] {
  return products.map((product, index) => ({
    productId: product.id,
    customerName: CUSTOMER_NAMES[index % CUSTOMER_NAMES.length],
    text: createQuestionText(product, index),
  }));
}

function createQuestionText(product: MockProductSeed, index: number): string {
  const category = product.category.toLocaleLowerCase('tr-TR');
  const fit = findAttribute(product, ['Kalıp', 'Kesim Kalıbı', 'Siluet']);
  const material = findAttribute(product, [
    'Materyal Bileşeni',
    'Materyal',
    'Kumaş Tipi',
  ]);
  const color = findAttribute(product, ['Renk']) ?? product.colors[0];
  const sizes = product.sizes?.filter(Boolean) ?? [];
  const middleSize = sizes[Math.floor(sizes.length / 2)];

  if (/pantolon|jean|şort|eşofman/.test(category)) {
    const questions = [
      `${fit ? `${fit} kalıpta ` : ''}normalde 32 beden giyiyorum, aynı bedeni mi almalıyım?`,
      `${material ? `${material} kumaş ` : 'Kumaşı '}esnek mi ve diz izi yapar mı?`,
      `${color ? `${color} rengin ` : 'Rengin '}yıkamada solma ihtimali var mı?`,
      `${middleSize ? `${middleSize} bedenin ` : 'Bu ürünün '}bel ve paça ölçüleri nedir?`,
      'Ürünün beli lastikli veya bağcıklı mı, cepleri kullanışlı mı?',
    ];
    return questions[index % questions.length];
  }

  if (/gömlek|t-shirt|tişört|sweatshirt|kazak|hırka|atlet/.test(category)) {
    const questions = [
      `${fit ? `${fit} kalıp ` : ''}çok bol veya dar durur mu, normal bedenimi alabilir miyim?`,
      `${material ? `${material} kumaş ` : 'Kumaşı '}yazın terletir mi ve iç gösterir mi?`,
      `${color ? `${color} renk ` : 'Bu renk '}yıkamada solma veya çekme yapar mı?`,
      `${middleSize ? `${middleSize} bedenin ` : 'Ürünün '}göğüs genişliği ve boy uzunluğu kaç cm?`,
      'Yaka ve kol yapısı nasıldır, ürünün bakım talimatı nedir?',
    ];
    return questions[index % questions.length];
  }

  if (/mont|ceket|yağmurluk|yelek/.test(category)) {
    const questions = [
      `${fit ? `${fit} kalıpta ` : ''}içine sweatshirt giymek için bir beden büyük mü almalıyım?`,
      `${material ? `${material} malzeme ` : 'Ürün '}rüzgâr ve yağmura karşı koruma sağlar mı?`,
      'Ürünün iç astarı ve cepleri var mı, kışın sıcak tutar mı?',
      `${middleSize ? `${middleSize} bedenin ` : 'Ürünün '}göğüs ve boy ölçüsü nedir?`,
      'Kapüşonu çıkarılabiliyor mu ve fermuarı suya dayanıklı mı?',
    ];
    return questions[index % questions.length];
  }

  if (/ayakkabı|sneaker|terlik|bot/.test(category)) {
    return `${middleSize ? `${middleSize} numaranın ` : 'Ürünün '}iç taban uzunluğu kaç cm, kalıbı dar mı?`;
  }

  if (/kemer/.test(category)) {
    return `${material ? `${material} materyal ` : 'Ürün '}hakiki deri mi, tokasında kararma olur mu?`;
  }

  return `${product.title} için kalıp, materyal ve bakım bilgilerini paylaşabilir misiniz?`;
}

function findAttribute(
  product: MockProductSeed,
  names: string[],
): string | undefined {
  const normalizedNames = names.map((name) => name.toLocaleLowerCase('tr-TR'));
  return product.attributes.find((attribute) =>
    normalizedNames.includes(attribute.name.toLocaleLowerCase('tr-TR')),
  )?.value;
}

function resolveExternalProductId(
  productId: number,
  products: MockProductSeed[],
): number | string {
  const product = products.find((candidate) => candidate.id === productId);
  return product?.source?.productId ?? productId;
}

function afterConnection(date: Date, offsetMs: number) {
  return new Date(Math.max(Date.now() - 5 * 60_000, date.getTime() + offsetMs));
}
