import type { CatalogProduct } from "@/types/product"

export type ProductQuestionStatus =
  "PENDING" | "DRAFTED" | "ANSWERED" | "IGNORED"

export type ProductQuestionFilter = "ALL" | "PENDING" | "ANSWERED" | "IGNORED"

export type QuestionAnswerStatus = "QUEUED" | "PROCESSING" | "SENT" | "FAILED"
export type QuestionAnswerOrigin = "MANUAL" | "AUTOMATION"
export type QuestionAnswerComposition = "MANUAL" | "AI_UNCHANGED" | "AI_EDITED"
export type AiDraftTrigger = "MANUAL" | "AUTOMATION"
export type AiAutomationMode = "OFF" | "SHADOW" | "SAFE_AUTO"
export type AiDraftOutcome =
  "AVAILABLE" | "SUPERSEDED" | "SELECTED" | "SENT" | "FAILED"

export type QuestionDraftProcessingStatus =
  "QUEUED" | "PROCESSING" | "FAILED" | "BLOCKED_QUOTA" | "BLOCKED_SUBSCRIPTION"

export type QuestionReplyDecision =
  "READY_FOR_SEND" | "NEEDS_REVIEW" | "DO_NOT_REPLY"

export type ProductAnswerRisk =
  | "MISSING_INFORMATION"
  | "UNSUPPORTED_CLAIM"
  | "STOCK_CONTRADICTION"
  | "PRICE_CONTRADICTION"
  | "STALE_INVENTORY"
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
  draftAttemptId: string | null
  answer: string
  origin: QuestionAnswerOrigin
  composition: QuestionAnswerComposition
  status: QuestionAnswerStatus
  attempts: number
  lastError: string | null
  queuedAt: string
  sentAt: string | null
}

export type AiDraftAttempt = {
  id: string
  trigger: AiDraftTrigger
  outcome: AiDraftOutcome
  answer: string
  decision: Exclude<QuestionReplyDecision, "DO_NOT_REPLY">
  confidence: number
  answerability: "FULL" | "PARTIAL" | "INSUFFICIENT"
  risks: ProductAnswerRisk[]
  missingInformation: string[]
  evidenceIds: string[]
  model: string
  interpretation: string | null
  requestedFacts: ProductAnswerFact[] | null
  detectedFacts: ProductAnswerFact[] | null
  automationMode: AiAutomationMode
  autoSendEligible: boolean
  appliedConfidenceThreshold: number
  eligibilityReasons: string[]
  selectedAt: string | null
  finalizedAt: string | null
  createdAt: string
  requestedBy: { name: string } | null
}

export type ProductQuestion = {
  id: string
  externalQuestionId: string
  externalProductId: string
  customerName: string | null
  question: string
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
  draftProcessingStatus: QuestionDraftProcessingStatus | null
  draftProcessingError: string | null
  draftQueuedAt: string | null
  draftProcessingStartedAt: string | null
  answeredAt: string | null
  externalCreatedAt: string
  createdAt: string
  connection: {
    providerKey: string
  }
  product: CatalogProduct | null
  productSnapshot: {
    title: string
    imageUrl: string | null
  } | null
  draftAttempts: AiDraftAttempt[]
  answerDelivery: QuestionAnswerDelivery | null
}

export type ProductQuestionListItem = {
  id: string
  externalProductId: string
  customerName: string | null
  question: string
  status: ProductQuestionStatus
  draftDecision: QuestionReplyDecision | null
  draftProcessingStatus: QuestionDraftProcessingStatus | null
  externalCreatedAt: string
  connection: {
    providerKey: string
  }
  product: {
    id: string
    title: string
    imageUrl: string | null
  } | null
  productSnapshot: {
    title: string
    imageUrl: string | null
  } | null
  answerDelivery: Pick<QuestionAnswerDelivery, "status"> | null
  draftAttempts: Array<
    Pick<
      AiDraftAttempt,
      "automationMode" | "autoSendEligible" | "appliedConfidenceThreshold"
    >
  >
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

export type ProductQuestionListSlice = Pick<
  ProductQuestionPage,
  "items" | "nextCursor"
>

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
    attemptId: string
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
    autoSend: {
      eligible: boolean
      mode: AiAutomationMode
      appliedConfidenceThreshold: number
      reasons: string[]
    }
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
