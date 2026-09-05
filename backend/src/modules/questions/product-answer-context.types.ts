export type ProductAnswerFact =
  | 'STOCK'
  | 'PRICE'
  | 'MATERIAL'
  | 'DURABILITY'
  | 'SHIPPING'
  | 'RETURN'
  | 'EXCHANGE'
  | 'WARRANTY'
  | 'SIZE'
  | 'COLOR'
  | 'FIT'
  | 'CARE'
  | 'PRODUCT_CODE'
  | 'PRODUCT_INFO';

export type ProductAnswerEvidenceSource =
  | 'ATTRIBUTE'
  | 'DESCRIPTION'
  | 'VARIANT'
  | 'TITLE'
  | 'SIZE_GUIDE'
  | 'PLATFORM_GUIDANCE'
  | 'STORE_KNOWLEDGE'
  | 'CHANNEL_OVERRIDE'
  | 'FAQ';

export type ProductAnswerEvidence = {
  id: string;
  fact: ProductAnswerFact;
  label: string;
  value: string;
  source: ProductAnswerEvidenceSource;
  confidence?: number;
};

export type ProductAnswerRisk =
  | 'MISSING_INFORMATION'
  | 'UNSUPPORTED_CLAIM'
  | 'STOCK_CONTRADICTION'
  | 'PRICE_CONTRADICTION'
  | 'STALE_INVENTORY'
  | 'LOW_CONFIDENCE'
  | 'HIGH_RISK_INTENT';

export type QuestionReplyDecision =
  'READY_FOR_SEND' | 'NEEDS_REVIEW' | 'DO_NOT_REPLY';

export type ProductAnswerVariantContext = {
  title: string | null;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  currency: string;
  stock: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'UNAVAILABLE' | 'ARCHIVED';
  lastSyncedAt: string | null;
};

export type ProductAnswerSizeGuideContext = {
  id: string;
  sourceUrl: string;
  normalizedText: string;
  confidence: number | null;
};

export type ProductAnswerContext = {
  questionId: string;
  question: string;
  providerKey: string;
  requestedFacts: ProductAnswerFact[];
  mentionedColors: string[];
  requestedColor: string | null;
  requestedSize: string | null;
  matchedColor: string | null;
  matchedSize: string | null;
  product: {
    id: string;
    title: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    attributes: Array<{ name: string; value: string }>;
    variants: ProductAnswerVariantContext[];
    sizeGuides?: ProductAnswerSizeGuideContext[];
  };
  matchingVariants: ProductAnswerVariantContext[];
  inventoryFreshness: {
    status: 'FRESH' | 'STALE' | 'UNKNOWN';
    latestSyncedAt: string | null;
    maxAgeMs: number;
  };
  inventoryVerification?: {
    status: 'VERIFIED' | 'UNAVAILABLE';
    checkedAt: string | null;
  };
  relevantAttributes: Array<{ name: string; value: string }>;
  relevantDescription: string | null;
  evidence: ProductAnswerEvidence[];
  responsePreferences?: {
    automationMode: 'OFF' | 'SHADOW' | 'SAFE_AUTO';
    minimumAutoSendConfidence: number;
    tone: 'PROFESSIONAL' | 'FRIENDLY' | 'WARM' | 'MINIMAL';
    responseLength: 'SHORT' | 'BALANCED' | 'DETAILED';
    greetingEnabled: boolean;
    closingEnabled: boolean;
    emojiPolicy: 'NEVER' | 'WHEN_APPROPRIATE' | 'ALWAYS';
    preferredEmoji: string | null;
    instructions: string[];
    approvedAnswerExamples: Array<{
      question: string;
      answer: string;
    }>;
  };
};

export type DraftQuestionAnswer = DraftedQuestionAnswer | IgnoredQuestionAnswer;

export type DraftedQuestionAnswer = {
  answer: string;
  status: 'DRAFTED';
  context: {
    attemptId: string;
    autoSend: {
      eligible: boolean;
      mode: 'OFF' | 'SHADOW' | 'SAFE_AUTO';
      appliedConfidenceThreshold: number;
      reasons: string[];
    };
    requestedFacts: ProductAnswerFact[];
    matchedColor: string | null;
    matchedSize: string | null;
    matchingVariantCount: number;
    source: 'GEMINI';
    model: string;
    interpretation: string;
    detectedFacts: ProductAnswerFact[];
    answerability: 'FULL' | 'PARTIAL' | 'INSUFFICIENT';
    decision: Exclude<QuestionReplyDecision, 'DO_NOT_REPLY'>;
    confidence: number;
    missingInformation: string[];
    usedEvidenceIds: string[];
    risks: ProductAnswerRisk[];
  };
};

export type IgnoredQuestionAnswer = {
  answer: null;
  status: 'IGNORED';
  context: {
    source: 'POLICY';
    model: null;
    decision: 'DO_NOT_REPLY';
    policyReason: 'ABUSIVE_CONTENT';
  };
};
