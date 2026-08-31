import type { CatalogProduct } from "@/types/product"

export type ProductQuestionStatus =
  "PENDING" | "DRAFTED" | "ANSWERED" | "IGNORED"

export type QuestionAnswerStatus = "QUEUED" | "PROCESSING" | "SENT" | "FAILED"

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
  status: ProductQuestionStatus
  answer: string | null
  answeredAt: string | null
  externalCreatedAt: string
  createdAt: string
  connection: {
    providerKey: string
  }
  product: CatalogProduct | null
  answerDelivery: QuestionAnswerDelivery | null
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

export type DraftQuestionAnswerResult = {
  answer: string
  status: "DRAFTED"
  context: {
    requestedFacts: Array<
      | "STOCK"
      | "PRICE"
      | "MATERIAL"
      | "DURABILITY"
      | "SHIPPING"
      | "SIZE"
      | "COLOR"
      | "FIT"
      | "CARE"
      | "PRODUCT_CODE"
      | "PRODUCT_INFO"
    >
    matchedColor: string | null
    matchedSize: string | null
    matchingVariantCount: number
    source: "GEMINI"
    model: string
    decision: "DRAFT" | "NEEDS_REVIEW"
    confidence: number
    missingInformation: string[]
    usedEvidenceIds: string[]
    risks: Array<
      | "MISSING_INFORMATION"
      | "UNSUPPORTED_CLAIM"
      | "STOCK_CONTRADICTION"
      | "PRICE_CONTRADICTION"
      | "LOW_CONFIDENCE"
      | "HIGH_RISK_INTENT"
    >
  }
}
