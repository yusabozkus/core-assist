import type { AdminBillingPlan } from "@/types/admin-billing"
import type { BillingSubscriptionStatus } from "@/types/billing"

export type AdminAiUsagePeriod = "7D" | "30D" | "90D"

export type AdminAiBlockerType =
  | "generation-failures"
  | "delivery-failures"
  | "quota"
  | "subscription"
  | "missing-information"
  | "knowledge-conflicts"

export type AdminAiBlockerItem = {
  id: string
  kind: "QUESTION" | "DELIVERY" | "KNOWLEDGE"
  title: string
  description: string
  error: string | null
  occurredAt: string
  status: string
  questionId: string | null
  externalQuestionId: string | null
  store: {
    id: string
    name: string
    account: {
      id: string
      name: string
      owner: { name: string; email: string }
    }
  }
  metadata: Array<{ label: string; value: string }>
}

export type AdminAiBlockerList = {
  type: AdminAiBlockerType
  title: string
  description: string
  total: number
  items: AdminAiBlockerItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  generatedAt: string
}

export type AdminAiUsage = {
  period: AdminAiUsagePeriod
  periodStart: string
  periodEnd: string
  summary: {
    totalDrafts: number
    previousPeriodDrafts: number
    draftChangePercentage: number | null
    averageConfidence: number | null
    readyForSend: number
    needsReview: number
    doNotReply: number
    autoSendEligible: number
    autoSent: number
    autoFailed: number
    manualSent: number
    billedAiQuestions: number
  }
  blockers: {
    generationFailures: number
    deliveryFailures: number
    quota: number
    subscription: number
    missingInformation: number
    knowledgeConflicts: number
  }
  quotaUsage: Array<{
    workspaceId: string
    workspaceName: string
    ownerName: string
    ownerEmail: string
    plan: AdminBillingPlan
    status: BillingSubscriptionStatus
    used: number
    limit: number
    utilization: number
    periodStart: string
    periodEnd: string
  }>
  topStores: Array<{
    store: {
      id: string
      name: string
      workspace: { id: string; name: string }
    }
    drafts: number
    averageConfidence: number | null
  }>
  models: Array<{
    model: string
    drafts: number
    averageConfidence: number | null
  }>
  daily: Array<{
    date: string
    drafts: number
    averageConfidence: number | null
  }>
  generatedAt: string
}
