import { Injectable } from '@nestjs/common';
import type { ConnectorContext } from './catalog-connector';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
} from './question-connector';

@Injectable()
export class MockQuestionConnector {
  fetchProductQuestions(
    providerKey: string,
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    void context;

    if (options.cursor) {
      return Promise.resolve({ questions: [] });
    }

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
  const firstQuestionAt = afterConnection(createdAfter, 1);
  const secondQuestionAt = afterConnection(createdAfter, 2);
  const historicalQuestionAt = new Date(createdAfter.getTime() - 60 * 60_000);

  if (providerKey === 'hepsiburada') {
    return [
      {
        externalId: 'hb-question-7001',
        externalProductId: 'hb-listing-2001',
        externalCustomerId: 'hb-customer-81',
        customerName: 'Deniz K.',
        text: 'Siyah rengin 42 numarası şu anda stokta mı?',
        createdAt: firstQuestionAt,
        rawPayload: { fixture: true, provider: 'hepsiburada' },
      },
      {
        externalId: 'hb-question-7002',
        externalProductId: 'hb-listing-2002',
        externalCustomerId: 'hb-customer-92',
        customerName: 'Burak T.',
        text: 'Çantanın hacmi kaç litre ve suya dayanıklı mı?',
        createdAt: secondQuestionAt,
        rawPayload: { fixture: true, provider: 'hepsiburada' },
      },
      {
        externalId: 'hb-question-historical',
        externalProductId: 'hb-listing-2001',
        text: 'Bu soru bağlantı kurulmadan önce gönderildi.',
        createdAt: historicalQuestionAt,
        rawPayload: {
          fixture: true,
          historical: true,
          provider: 'hepsiburada',
        },
      },
    ];
  }

  return [
    {
      externalId: 'ty-question-5001',
      externalProductId: 'ty-content-1001',
      externalCustomerId: 'ty-customer-42',
      customerName: 'Ayşe Y.',
      text: 'Siyah M beden tekrar stoğa gelecek mi?',
      createdAt: firstQuestionAt,
      rawPayload: { fixture: true, provider: 'trendyol' },
    },
    {
      externalId: 'ty-question-5002',
      externalProductId: 'ty-content-1002',
      externalCustomerId: 'ty-customer-57',
      customerName: 'Mehmet A.',
      text: 'Mavi L beden mevcut mu, kalıbı nasıldır?',
      createdAt: secondQuestionAt,
      rawPayload: { fixture: true, provider: 'trendyol' },
    },
    {
      externalId: 'ty-question-historical',
      externalProductId: 'ty-content-1001',
      text: 'Bu soru bağlantı kurulmadan önce gönderildi.',
      createdAt: historicalQuestionAt,
      rawPayload: {
        fixture: true,
        historical: true,
        provider: 'trendyol',
      },
    },
  ];
}

function afterConnection(date: Date, offsetMs: number) {
  return new Date(Math.max(Date.now() - 5 * 60_000, date.getTime() + offsetMs));
}
