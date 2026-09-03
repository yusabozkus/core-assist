import type { CatalogProduct } from "@/types/product"

export type ProductQuestionStatus =
  "PENDING" | "DRAFTED" | "ANSWERED" | "IGNORED"

export type ProductQuestionFilter = "ALL" | "PENDING" | "ANSWERED" | "IGNORED"

export type QuestionAnswerStatus = "QUEUED" | "PROCESSING" | "SENT" | "FAILED"

export type QuestionReplyDecision =
  "READY_FOR_SEND" | "NEEDS_REVIEW" | "DO_NOT_REPLY"

export type ProductAnswerRisk =
  | "MISSING_INFORMATION"
  | "UNSUPPORTED_CLAIM"
  | "STOCK_CONTRADICTION"
  | "PRICE_CONTRADICTION"
  | "LOW_CONFIDENCE"
  | "HIGH_RISK_INTENT"

export type ProductAnswerFact =
  | "STOCK"
  | "PRICE"
  | "MATERIAL"
  | "DURABILITY"
  | "SHIPPING"
  | "RETURN"
  | "EXCHANGE"
  | "WARRANTY"
  | "SIZE"
  | "COLOR"
  | "FIT"
  | "CARE"
  | "PRODUCT_CODE"
  | "PRODUCT_INFO"

export type QuestionAnswerDelivery = {
  id: string
  answer: string
  status: QuestionAnswerStatus
  attempts: number
  lastError: string | null
  queuedAt: string
  sentAt: string | null
}

export type ProductQuestion = {
  id: string
  externalQuestionId: string
  externalProductId: string
  customerName: string | null
  question: string
  referenceAnswer: string | null
  referenceSourceUrl: string | null
  referenceSourceProvider: string | null
  status: ProductQuestionStatus
  answer: string | null
  draftDecision: QuestionReplyDecision | null
  draftConfidence: number | null
  draftAnswerability: "FULL" | "PARTIAL" | "INSUFFICIENT" | null
  draftRisks: ProductAnswerRisk[] | null
  draftMissingInformation: string[] | null
  draftEvidenceIds: string[] | null
  draftModel: string | null
  draftedAt: string | null
  answeredAt: string | null
  externalCreatedAt: string
  createdAt: string
  connection: {
    providerKey: string
  }
  product: CatalogProduct | null
  answerDelivery: QuestionAnswerDelivery | null
}

export type ProductQuestionListItem = {
  id: string
  externalProductId: string
  customerName: string | null
  question: string
  status: ProductQuestionStatus
  draftDecision: QuestionReplyDecision | null
  externalCreatedAt: string
  connection: {
    providerKey: string
  }
  product: {
    id: string
    title: string
    imageUrl: string | null
  } | null
  answerDelivery: Pick<QuestionAnswerDelivery, "status"> | null
}

export type ProductQuestionPage = {
  items: ProductQuestionListItem[]
  nextCursor: string | null
  total: number
  summary: {
    total: number
    pending: number
    answered: number
    ignored: number
  }
}

export type QuestionSyncResult = {
  status: "RUNNING"
  queued: number
  skipped: number
  syncRunIds: string[]
}

export type QueueQuestionAnswerResult = {
  id: string
  status: "QUEUED"
  queuedAt: string
}

export type DraftQuestionAnswerResult =
  DraftedQuestionAnswerResult | IgnoredQuestionAnswerResult

export type DraftedQuestionAnswerResult = {
  answer: string
  status: "DRAFTED"
  context: {
    requestedFacts: ProductAnswerFact[]
    matchedColor: string | null
    matchedSize: string | null
    matchingVariantCount: number
    source: "GEMINI"
    model: string
    interpretation: string
    detectedFacts: ProductAnswerFact[]
    answerability: "FULL" | "PARTIAL" | "INSUFFICIENT"
    decision: "READY_FOR_SEND" | "NEEDS_REVIEW"
    confidence: number
    missingInformation: string[]
    usedEvidenceIds: string[]
    risks: ProductAnswerRisk[]
  }
}

export type IgnoredQuestionAnswerResult = {
  answer: null
  status: "IGNORED"
  context: {
    source: "POLICY"
    model: null
    decision: "DO_NOT_REPLY"
    policyReason: "ABUSIVE_CONTENT"
  }
}
