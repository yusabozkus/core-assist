import { ProductVariantStatus } from '../../generated/prisma/enums';
import type { ProductAnswerContext } from '../questions/product-answer-context.types';
import { GeminiClientService } from './gemini-client.service';
import { GeminiDraftService } from './gemini-draft.service';

describe('GeminiDraftService', () => {
  const generate = jest.fn();
  const isEnabled = jest.fn();
  const client = { generate, isEnabled } as unknown as GeminiClientService;
  let service: GeminiDraftService;

  beforeEach(() => {
    jest.clearAllMocks();
    isEnabled.mockReturnValue(true);
    service = new GeminiDraftService(client);
  });

  it('uses the fast model for a confident simple stock answer', async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        answer: 'Merhaba, siyah M beden şu anda stokta mevcut.',
        decision: 'DRAFT',
        confidence: 0.95,
        usedFacts: ['STOCK'],
        missingInformation: [],
      }),
    );

    const result = await service.generate(createContext());

    expect(result?.source).toBe('GEMINI_FAST');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ thinkingLevel: 'minimal' }),
    );
  });

  it('falls back to the smart model for a low-confidence fast draft', async () => {
    generate
      .mockResolvedValueOnce(
        JSON.stringify({
          answer: 'Kontrol etmemiz gerekiyor.',
          decision: 'NEEDS_REVIEW',
          confidence: 0.4,
          usedFacts: [],
          missingInformation: ['Varyant bilgisi'],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          answer: 'Merhaba, siyah M beden şu anda stokta mevcut.',
          decision: 'DRAFT',
          confidence: 0.91,
          usedFacts: ['STOCK'],
          missingInformation: [],
        }),
      );

    const result = await service.generate(createContext());

    expect(result?.source).toBe('GEMINI_SMART');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('rejects an answer that invents available stock', async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        answer: 'Merhaba, ürün stokta mevcut.',
        decision: 'DRAFT',
        confidence: 0.99,
        usedFacts: ['STOCK'],
        missingInformation: [],
      }),
    );
    const context = createContext({
      product: {
        ...createContext().product,
        variants: [
          {
            ...createContext().product.variants[0],
            stock: 0,
            status: ProductVariantStatus.OUT_OF_STOCK,
          },
        ],
      },
      matchingVariants: [
        {
          ...createContext().matchingVariants[0],
          stock: 0,
          status: ProductVariantStatus.OUT_OF_STOCK,
        },
      ],
    });

    const result = await service.generate(context);

    expect(result).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('rejects drafts that redirect the customer back to customer service', async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        answer:
          'Ürün hakiki deridir. Detaylı bilgi için müşteri hizmetleriyle iletişime geçebilirsiniz.',
        decision: 'NEEDS_REVIEW',
        confidence: 0.7,
        usedFacts: ['MATERIAL'],
        missingInformation: ['Toka kararma bilgisi'],
      }),
    );

    const result = await service.generate(
      createContext({
        question: 'Kemer hakiki deri mi, tokasında kararma olur mu?',
        requestedFacts: ['MATERIAL', 'DURABILITY'],
      }),
    );

    expect(result).toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('keeps a grounded partial answer and marks missing durability information', async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        answer:
          'Merhaba, kemer hakiki deriden üretilmiştir. Toka için kararma dayanımı ürün bilgilerinde belirtilmediğinden bu konuda kesin bilgi veremiyoruz.',
        decision: 'NEEDS_REVIEW',
        confidence: 0.82,
        usedFacts: ['MATERIAL'],
        missingInformation: ['Toka kararma dayanımı'],
      }),
    );

    const result = await service.generate(
      createContext({
        question: 'Kemer hakiki deri mi, tokasında kararma olur mu?',
        requestedFacts: ['MATERIAL', 'DURABILITY'],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        source: 'GEMINI_SMART',
        decision: 'NEEDS_REVIEW',
        missingInformation: ['Toka kararma dayanımı'],
      }),
    );
  });

  it('skips Gemini when AI drafts are disabled', async () => {
    isEnabled.mockReturnValue(false);

    await expect(service.generate(createContext())).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
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
    question: 'Siyah M beden stokta var mı?',
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
