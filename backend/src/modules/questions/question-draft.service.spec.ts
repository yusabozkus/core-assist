import {
  ProductQuestionStatus,
  ProductVariantStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ProductAnswerContextService } from './product-answer-context.service';
import type { ProductAnswerContext } from './product-answer-context.types';
import { QuestionDraftService } from './question-draft.service';

describe('QuestionDraftService', () => {
  const buildContext = jest.fn();
  const updateQuestion = jest.fn();
  const prisma = {
    productQuestion: { updateMany: updateQuestion },
  } as unknown as PrismaService;
  const contextService = {
    build: buildContext,
  } as unknown as ProductAnswerContextService;
  const service = new QuestionDraftService(prisma, contextService);

  beforeEach(() => {
    jest.clearAllMocks();
    updateQuestion.mockResolvedValue({ count: 1 });
  });

  it('creates and persists a stock and price draft from catalog data', async () => {
    buildContext.mockResolvedValue(
      createContext({ requestedFacts: ['STOCK', 'PRICE'] }),
    );

    const result = await service.generate('store-1', 'question-1');

    expect(result.status).toBe('DRAFTED');
    expect(result.answer).toContain('Siyah / M seçeneği şu anda stokta mevcut');
    expect(result.answer).toContain('649,90');
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answer: result.answer,
          status: ProductQuestionStatus.DRAFTED,
        }),
      }),
    );
  });

  it('does not invent stock for an unavailable requested variant', async () => {
    buildContext.mockResolvedValue(
      createContext({
        requestedColor: 'Kırmızı',
        requestedSize: null,
        matchedColor: null,
        matchedSize: null,
        matchingVariants: [],
      }),
    );

    const result = await service.generate('store-1', 'question-1');

    expect(result.answer).toContain('Kırmızı seçeneği katalogda bulunmuyor');
  });
});

function createContext(
  overrides: Partial<ProductAnswerContext> = {},
): ProductAnswerContext {
  const variant = {
    title: 'Siyah / M',
    sku: 'SKU-BLACK-M',
    color: 'Siyah',
    size: 'M',
    price: 649.9,
    currency: 'TRY',
    stock: 4,
    status: ProductVariantStatus.ACTIVE,
  };

  return {
    questionId: 'question-1',
    question: 'Siyah M var mı, fiyatı nedir?',
    requestedFacts: ['STOCK'],
    requestedColor: 'Siyah',
    requestedSize: 'M',
    matchedColor: 'Siyah',
    matchedSize: 'M',
    product: {
      id: 'product-1',
      title: 'Pamuklu Tişört',
      description: 'Yumuşak dokulu pamuklu tişört.',
      attributes: [{ name: 'Materyal', value: '%100 Pamuk' }],
      variants: [variant],
    },
    matchingVariants: [variant],
    relevantAttributes: [],
    ...overrides,
  };
}
