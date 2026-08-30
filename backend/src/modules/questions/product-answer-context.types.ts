export type ProductAnswerFact =
  'STOCK' | 'PRICE' | 'MATERIAL' | 'DURABILITY' | 'SHIPPING' | 'PRODUCT_INFO';

export type ProductAnswerVariantContext = {
  title: string | null;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  currency: string;
  stock: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'UNAVAILABLE' | 'ARCHIVED';
};

export type ProductAnswerContext = {
  questionId: string;
  question: string;
  requestedFacts: ProductAnswerFact[];
  requestedColor: string | null;
  requestedSize: string | null;
  matchedColor: string | null;
  matchedSize: string | null;
  product: {
    id: string;
    title: string;
    description: string | null;
    attributes: Array<{ name: string; value: string }>;
    variants: ProductAnswerVariantContext[];
  };
  matchingVariants: ProductAnswerVariantContext[];
  relevantAttributes: Array<{ name: string; value: string }>;
};

export type DraftQuestionAnswer = {
  answer: string;
  status: 'DRAFTED';
  context: {
    requestedFacts: ProductAnswerFact[];
    matchedColor: string | null;
    matchedSize: string | null;
    matchingVariantCount: number;
    source: 'CATALOG' | 'GEMINI_FAST' | 'GEMINI_SMART';
    model: string | null;
    decision: 'DRAFT' | 'NEEDS_REVIEW';
    confidence: number | null;
    missingInformation: string[];
  };
};
