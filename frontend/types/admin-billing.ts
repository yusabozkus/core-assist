import type { BillingSubscriptionStatus } from "@/types/billing"

export type AdminBillingPlan = "STARTER" | "GROWTH" | "BUSINESS"
export type AdminBillingCycle = "MONTHLY" | "ANNUAL"
export type AdminPaddleEnvironment = "SANDBOX" | "PRODUCTION"
export type AdminBillingCheckoutStatus =
  "CREATING" | "OPEN" | "REVIEW_REQUIRED" | "COMPLETED" | "CANCELED" | "FAILED"
export type AdminBillingPlanChangeStatus =
  | "PREVIEWED"
  | "PROCESSING"
  | "RETRY_SCHEDULED"
  | "AWAITING_WEBHOOK"
  | "COMPLETED"
  | "FAILED"
  | "REVIEW_REQUIRED"

export type AdminBillingCheckout = {
  id: string
  requestedByUserId?: string | null
  environment: AdminPaddleEnvironment
  status: AdminBillingCheckoutStatus
  plan: AdminBillingPlan
  cycle: AdminBillingCycle
  paddlePriceId?: string
  paddleTransactionId: string | null
  expectedPaddleCustomerId?: string | null
  previousPaddleSubscriptionId?: string | null
  paddleSubscriptionId?: string | null
  boundAt?: string | null
  createdAt?: string
  updatedAt: string
}

export type AdminBillingPlanChange = {
  id: string
  requestedByUserId?: string | null
  environment: AdminPaddleEnvironment
  status: AdminBillingPlanChangeStatus
  paddleSubscriptionId?: string
  paddleCustomerId?: string
  sourcePriceId?: string
  targetPriceId?: string
  plan: AdminBillingPlan
  cycle: AdminBillingCycle
  expiresAt?: string
  submittedAt?: string | null
  retryAfterSeconds?: number | null
  retryAt: string | null
  retryCount?: number
  completedAt?: string | null
  failureCode: string | null
  createdAt?: string
  updatedAt: string
}

export type AdminBillingSummary = {
  id: string
  workspace: {
    id: string
    name: string
    owner: {
      id: string
      name: string
      email: string
      image: string | null
    }
  }
  plan: AdminBillingPlan
  cycle: AdminBillingCycle
  status: BillingSubscriptionStatus
  hasAccess: boolean
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  scheduledAccessEndsAt: string | null
  paddleCustomerId: string | null
  paddleSubscriptionId: string | null
  lastReconciledAt: string | null
  reconcileAfter: string
  reconcileFailures: number
  reconcileErrorCode: string | null
  usage: {
    aiQuestions: number
    limit: number
    periodStart: string
    periodEnd: string
  } | null
  pendingCheckout: AdminBillingCheckout | null
  pendingPlanChange: AdminBillingPlanChange | null
  createdAt: string
  updatedAt: string
}

export type AdminBillingList = {
  items: AdminBillingSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    total: number
    active: number
    paymentIssues: number
    reconciliationIssues: number
    pendingOperations: number
  }
}

export type AdminBillingQuery = {
  q?: string
  plan?: AdminBillingPlan
  status?: BillingSubscriptionStatus
  issue?: "PAYMENT" | "RECONCILIATION" | "CHECKOUT" | "PLAN_CHANGE"
  sort?: "UPDATED" | "PERIOD_END" | "FAILURES"
  page?: number
  pageSize?: number
}

export type AdminBillingDetail = Omit<AdminBillingSummary, "workspace"> & {
  workspace: AdminBillingSummary["workspace"] & {
    createdAt: string
  }
  trialEndsAt: string | null
  canceledAt: string | null
  paddlePriceId: string | null
  paddleUpdatedAt: string | null
  paddleSnapshotAt: string | null
  usagePeriodAnchor: string | null
  entitlements: {
    monthlyAiQuestions: number
    stores: number
    members: number
    activeProducts: number
    providerKeys: readonly string[]
  }
  usagePeriods: Array<{
    id: string
    periodStart: string
    periodEnd: string
    aiQuestionUnits: number
    createdAt: string
    updatedAt: string
  }>
  checkouts: AdminBillingCheckout[]
  planChanges: AdminBillingPlanChange[]
}
