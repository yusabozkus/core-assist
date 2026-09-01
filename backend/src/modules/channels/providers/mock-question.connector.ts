import { Injectable } from '@nestjs/common';
import type { ConnectorContext } from './catalog-connector';
import { DEFACTO_QUESTION_SEEDS } from './fixtures/defacto-question-seeds';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
} from './question-connector';

export const MOCK_TRENDYOL_QUESTIONS = DEFACTO_QUESTION_SEEDS.filter(
  (seed) => seed.targetProvider === 'trendyol',
).length;
export const MOCK_HEPSIBURADA_QUESTIONS = DEFACTO_QUESTION_SEEDS.filter(
  (seed) => seed.targetProvider === 'hepsiburada',
).length;
export const MOCK_REFERENCED_TRENDYOL_QUESTIONS = DEFACTO_QUESTION_SEEDS.filter(
  (seed) =>
    seed.targetProvider === 'trendyol' &&
    seed.referenceAnswer &&
    seed.referenceSourceUrl,
).length;
export const MOCK_ABUSIVE_QUESTIONS = DEFACTO_QUESTION_SEEDS.filter(
  (seed) => seed.scenario === 'ABUSIVE',
).length;
export const MOCK_IRRELEVANT_QUESTIONS = DEFACTO_QUESTION_SEEDS.filter(
  (seed) => seed.scenario === 'IRRELEVANT',
).length;
export const MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER = 1;

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
  const productPrefix = isHepsiburada ? 'hb-listing' : 'ty-content';
  const seeds = DEFACTO_QUESTION_SEEDS.filter(
    (seed) => seed.targetProvider === providerKey,
  );

  const currentQuestions = seeds.map((seed, index) => ({
    externalId: `real-defacto-question-v1-${seed.id}`,
    externalProductId: `${productPrefix}-${seed.externalProductId}`,
    customerName: 'Pazaryeri müşterisi',
    text: seed.text,
    referenceAnswer: seed.referenceAnswer,
    referenceSourceUrl: seed.referenceSourceUrl,
    referenceSourceProvider: seed.referenceSourceProvider,
    createdAt: afterConnection(createdAfter, index + 1),
    rawPayload: {
      fixture: true,
      fixtureVersion: 1,
      scenario: seed.scenario ?? 'PRODUCT',
      provider: providerKey,
      sourceAskedAt: seed.sourceAskedAt,
      referenceSourceProvider: seed.referenceSourceProvider,
      referenceSourceUrl: seed.referenceSourceUrl,
    },
  }));

  return [
    ...currentQuestions,
    {
      externalId: `real-defacto-question-v1-${providerKey}-historical`,
      externalProductId: `${productPrefix}-${seeds[0]?.externalProductId ?? 'missing'}`,
      text: 'Bu soru bağlantı kurulmadan önce gönderildi.',
      createdAt: new Date(createdAfter.getTime() - 60 * 60_000),
      rawPayload: {
        fixture: true,
        fixtureVersion: 1,
        historical: true,
        provider: providerKey,
      },
    },
  ];
}

function afterConnection(date: Date, offset: number) {
  return new Date(
    Math.max(Date.now() - 5 * 60_000 + offset, date.getTime() + offset),
  );
}
