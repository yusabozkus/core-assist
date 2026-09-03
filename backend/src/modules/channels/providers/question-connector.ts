import type { ConnectorContext } from './catalog-connector';

export type NormalizedProductQuestion = {
  externalId: string;
  externalProductId: string;
  externalCustomerId?: string;
  customerName?: string;
  text: string;
  referenceAnswer?: string;
  referenceSourceUrl?: string;
  referenceSourceProvider?: string;
  createdAt: Date;
  rawPayload: Record<string, unknown>;
};

export type ProductQuestionBatch = {
  questions: NormalizedProductQuestion[];
  nextCursor?: string;
};

export type ProductQuestionAnswerResult = {
  externalAnswerId?: string;
  answeredAt: Date;
};

export interface ProductQuestionConnector {
  readonly providerKey: string;
  fetchProductQuestions(
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch>;
  sendProductQuestionAnswer(
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult>;
}
