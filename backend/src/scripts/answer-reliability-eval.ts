import 'dotenv/config';
import { GeminiClientService } from '../modules/ai/gemini-client.service';
import { GeminiDraftService } from '../modules/ai/gemini-draft.service';
import { MockCatalogConnector } from '../modules/channels/providers/mock-catalog.connector';
import { MockQuestionConnector } from '../modules/channels/providers/mock-question.connector';
import type { ConnectorContext } from '../modules/channels/providers/catalog-connector';
import { analyzeProductQuestion } from '../modules/questions/product-answer-context.service';
import type {
  ProductAnswerContext,
  ProductAnswerFact,
} from '../modules/questions/product-answer-context.types';

const PROVIDERS = ['trendyol', 'hepsiburada'] as const;
const connectorContext: ConnectorContext = {
  environment: 'SANDBOX',
  credentials: {},
};

async function run() {
  const contexts = await createEvaluationContexts();
  const deterministic = evaluateContexts(contexts);
  const withAi = process.argv.includes('--with-ai');
  const ai = withAi ? await evaluateAiDrafts(contexts) : null;

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode: withAi ? 'CONTEXT_AND_GEMINI' : 'CONTEXT_ONLY',
        ...deterministic,
        ai,
      },
      null,
      2,
    )}\n`,
  );
}

async function createEvaluationContexts() {
  const catalog = new MockCatalogConnector();
  const questions = new MockQuestionConnector();
  const contexts: ProductAnswerContext[] = [];

  for (const provider of PROVIDERS) {
    const [productBatch, questionBatch] = await Promise.all([
      catalog.fetchProducts(provider, connectorContext),
      questions.fetchProductQuestions(provider, connectorContext, {
        createdAfter: new Date(Date.now() - 60_000),
      }),
    ]);
    const productsByExternalId = new Map(
      productBatch.products.map((product) => [product.externalId, product]),
    );

    for (const question of questionBatch.questions.filter(
      (candidate) => candidate.rawPayload.historical !== true,
    )) {
      const product = productsByExternalId.get(question.externalProductId);
      if (!product) {
        throw new Error(
          `${provider}: ${question.externalId} sorusu ürünle eşleşmedi.`,
        );
      }

      contexts.push(
        analyzeProductQuestion({
          questionId: question.externalId,
          question: question.text,
          product: {
            id: product.externalId,
            title: product.title,
            description: product.description ?? null,
            attributes: product.attributes,
            variants: product.variants.map((variant) => ({
              title: variant.title ?? null,
              sku: variant.sku,
              color: variant.color ?? null,
              size: variant.size ?? null,
              price: variant.price,
              currency: variant.currency,
              stock: variant.stock,
              status: variant.stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
            })),
          },
        }),
      );
    }
  }

  if (contexts.length !== 60) {
    throw new Error(
      `60 yerine ${contexts.length} değerlendirme bağlamı oluştu.`,
    );
  }
  return contexts;
}

function evaluateContexts(contexts: ProductAnswerContext[]) {
  const intentCounts = new Map<ProductAnswerFact, number>();
  let totalFullPayloadBytes = 0;
  let totalEvidencePayloadBytes = 0;
  let contextsWithoutEvidence = 0;

  for (const context of contexts) {
    if (context.requestedFacts.length === 0) {
      throw new Error(`${context.questionId}: niyet tespit edilemedi.`);
    }
    if (
      new Set(context.evidence.map((item) => item.id)).size !==
      context.evidence.length
    ) {
      throw new Error(
        `${context.questionId}: yinelenen kanıt kimliği bulundu.`,
      );
    }
    if (context.evidence.length === 0) contextsWithoutEvidence += 1;

    for (const fact of context.requestedFacts) {
      intentCounts.set(fact, (intentCounts.get(fact) ?? 0) + 1);
    }
    totalFullPayloadBytes += Buffer.byteLength(
      JSON.stringify(context.product),
      'utf8',
    );
    totalEvidencePayloadBytes += Buffer.byteLength(
      JSON.stringify({
        question: context.question,
        intents: context.requestedFacts,
        evidence: context.evidence,
      }),
      'utf8',
    );
  }

  const payloadReduction =
    1 - totalEvidencePayloadBytes / Math.max(1, totalFullPayloadBytes);
  if (payloadReduction < 0.25) {
    throw new Error(
      `Kanıt bağlamı yeterince küçülmedi: %${Math.round(payloadReduction * 100)}.`,
    );
  }

  return {
    questions: contexts.length,
    matchedProducts: contexts.length,
    contextsWithEvidence: contexts.length - contextsWithoutEvidence,
    contextsWithoutEvidence,
    payloadReductionPercent: Math.round(payloadReduction * 100),
    intentCounts: Object.fromEntries(intentCounts),
  };
}

async function evaluateAiDrafts(contexts: ProductAnswerContext[]) {
  const generator = new GeminiDraftService(new GeminiClientService());
  let drafted = 0;
  let needsReview = 0;
  let unsupported = 0;

  for (const [index, context] of contexts.entries()) {
    const result = await generator.generate(context);
    if (!result) {
      throw new Error(`${context.questionId}: Gemini taslak üretemedi.`);
    }
    drafted += 1;
    if (result.decision === 'NEEDS_REVIEW') needsReview += 1;
    if (result.risks.includes('UNSUPPORTED_CLAIM')) unsupported += 1;
    process.stderr.write(`AI değerlendirme ${index + 1}/${contexts.length}\n`);
  }

  return { drafted, needsReview, unsupported };
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
