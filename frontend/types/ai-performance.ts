import type {
  AiDraftOutcome,
  AiDraftTrigger,
  AiAutomationMode,
  ProductAnswerFact,
  ProductQuestionStatus,
  QuestionDraftProcessingStatus,
  QuestionAnswerComposition,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from "@/types/question"

export type AiPerformanceRange = "7D" | "30D" | "90D" | "ALL"

export type AiPerformanceSelection =
  { kind: "REVIEW_REASON"; reason: string } | { kind: "FAILED_DELIVERY" }

export type AiPerformanceDetailScope = AiPerformanceSelection & {
  range: AiPerformanceRange
  provider: string | null
  asOf: string
  from: string | null
  timezone: string
}

export type AiPerformanceCursor = { questionId: string; before: string }

export type AiPerformanceQuestionPage = {
  totals: { questions: number; events: number }
  items: Array<{
    questionId: string
    question: string
    customerName: string | null
    productTitle: string | null
    providerKey: string
    status: ProductQuestionStatus
    draftDecision: QuestionReplyDecision | null
    draftProcessingStatus: QuestionDraftProcessingStatus | null
    deliveryStatus: QuestionAnswerStatus | null
    eventCount: number
    lastMatchedAt: string
  }>
  nextCursor: AiPerformanceCursor | null
}

export type AiPerformance = {
  range: AiPerformanceRange
  provider: string | null
  timezone: string
  availableProviders: string[]
  from: string | null
  generatedAt: string
  comparison: {
    from: string
    to: string
    totalDrafts: number
    aiAssisted: number
    autoSent: number
    acceptanceRate: number | null
    needsReviewRate: number | null
  } | null
  currentWorkload: {
    needsReview: number
  }
  summary: {
    totalDrafts: number
    uniqueQuestions: number
    reviewedAnswers: number
    averageConfidence: number
    confidenceSamples: number
    readyRate: number
    needsReviewRate: number
    acceptanceRate: number
    editRate: number
    aiCoverageRate: number
    deliverySuccessRate: number
    shadowEligibilityRate: number
  }
  answers: {
    totalSent: number
    aiAssisted: number
    acceptedUnchanged: number
    edited: number
    autoSent: number
    manualOnly: number
  }
  draftDecisions: {
    ready: number
    needsReview: number
    blocked: number
  }
  delivery: {
    failed: number
    queued: number
    processing: number
    successRate: number | null
  }
  trend: Array<{ date: string; drafts: number; sent: number }>
  trendGranularity: "day" | "month"
  reviewReasons: Array<{ key: string; count: number }>
  automation: {
    mode: AiAutomationMode
    evaluated: number
    eligible: number
    withheld: number
  }
  shadow: {
    evaluated: number
    wouldAutoSend: number
    keptForReview: number
  }
  providers: Array<{
    providerKey: string
    totalDrafts: number
    averageConfidence: number
    confidenceSamples: number
    readyRate: number
    needsReviewRate: number
    sentAnswers: number
    acceptedUnchanged: number
    editedAnswers: number
    autoSentAnswers: number
  }>
  intents: Array<{
    intent: ProductAnswerFact
    totalDrafts: number
    averageConfidence: number
    readyRate: number
    needsReviewRate: number
    autoSendEligibilityRate: number
    sentAnswers: number
    reviewedAnswers: number
    editRate: number
  }>
  recentActivity: Array<{
    id: string
    questionId: string
    question: string
    customerName: string | null
    productTitle: string | null
    providerKey: string
    trigger: AiDraftTrigger
    outcome: AiDraftOutcome
    decision: QuestionReplyDecision
    confidence: number
    answerability: "FULL" | "PARTIAL" | "INSUFFICIENT" | "OUT_OF_SCOPE"
    requestedFacts: ProductAnswerFact[]
    automationMode: AiAutomationMode
    autoSendEligible: boolean
    appliedConfidenceThreshold: number
    composition: QuestionAnswerComposition | null
    deliveryStatus: QuestionAnswerStatus | null
    deliveryOrigin: "MANUAL" | "AUTOMATION" | null
    eligibilityReasons: string[]
    createdAt: string
    sentAt: string | null
  }>
}
