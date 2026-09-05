import type {
  AiDraftOutcome,
  AiDraftTrigger,
  AiAutomationMode,
  ProductAnswerFact,
  QuestionAnswerComposition,
  QuestionAnswerStatus,
  QuestionReplyDecision,
} from "@/types/question"

export type AiPerformanceRange = "7D" | "30D" | "90D" | "ALL"

export type AiPerformance = {
  range: AiPerformanceRange
  from: string | null
  generatedAt: string
  summary: {
    totalDrafts: number
    averageConfidence: number
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
    requestedFacts: ProductAnswerFact[]
    automationMode: AiAutomationMode
    autoSendEligible: boolean
    appliedConfidenceThreshold: number
    composition: QuestionAnswerComposition | null
    deliveryStatus: QuestionAnswerStatus | null
    createdAt: string
    sentAt: string | null
  }>
}
