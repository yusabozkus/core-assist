import type { AdminBillingPlan } from "@/types/admin-billing"
import type { BillingSubscriptionStatus } from "@/types/billing"

export type AdminAiUsagePeriod = "7D" | "30D" | "90D"

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
