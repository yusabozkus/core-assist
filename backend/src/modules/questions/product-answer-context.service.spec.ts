import {
  ProductQuestionStatus,
  ProductVariantStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ProductAnswerContextService } from './product-answer-context.service';

describe('ProductAnswerContextService', () => {
  const findQuestion = jest.fn();
  const prisma = {
    productQuestion: { findFirst: findQuestion },
  } as unknown as PrismaService;
  const service = new ProductAnswerContextService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the requested color and size to a live catalog variant', async () => {
    findQuestion.mockResolvedValue(
      createQuestionFixture('Siyah M bedeni stokta var mı?'),
    );

    const context = await service.build('store-1', 'question-1');

    expect(context.requestedFacts).toContain('STOCK');
    expect(context.matchedColor).toBe('Siyah');
    expect(context.matchedSize).toBe('M');
    expect(context.matchingVariants).toEqual([
      expect.objectContaining({ color: 'Siyah', size: 'M', stock: 0 }),
    ]);
  });

  it('does not treat an unavailable requested color as all variants', async () => {
    findQuestion.mockResolvedValue(
      createQuestionFixture('Bu ürünün kırmızı rengi var mı?'),
    );

    const context = await service.build('store-1', 'question-1');

    expect(context.requestedColor).toBe('Kırmızı');
    expect(context.matchedColor).toBeNull();
    expect(context.matchingVariants).toHaveLength(0);
  });
});

function createQuestionFixture(question: string) {
  return {
    id: 'question-1',
    question,
    status: ProductQuestionStatus.PENDING,
    product: {
      id: 'product-1',
      title: 'Pamuklu Tişört',
      description: 'Yumuşak dokulu pamuklu tişört.',
      attributes: [{ name: 'Materyal', value: '%100 Pamuk' }],
      variants: [
        {
          title: 'Siyah / S',
          sku: 'SKU-BLACK-S',
          color: 'Siyah',
          size: 'S',
          price: '649.90',
          currency: 'TRY',
          stock: 4,
          status: ProductVariantStatus.ACTIVE,
        },
        {
          title: 'Siyah / M',
          sku: 'SKU-BLACK-M',
          color: 'Siyah',
          size: 'M',
          price: '649.90',
          currency: 'TRY',
          stock: 0,
          status: ProductVariantStatus.OUT_OF_STOCK,
        },
        {
          title: 'Beyaz / M',
          sku: 'SKU-WHITE-M',
          color: 'Beyaz',
          size: 'M',
          price: '649.90',
          currency: 'TRY',
          stock: 3,
          status: ProductVariantStatus.ACTIVE,
        },
      ],
    },
  };
}
