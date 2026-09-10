export type BillingCycle = "monthly" | "annual"

export type BillingPlanId = "starter" | "growth" | "business"

export type SubscriptionPlan = {
  id: BillingPlanId
  name: string
  description: string
  monthlyPrice: number
  questions: number
  stores: number
  members: number
  products: number
  support: string
  features: readonly string[]
  highlighted?: boolean
}

export type BillingSubscriptionStatus =
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELED" | "EXPIRED"

type BillingCapacityUsage = {
  used: number
  limit: number
  remaining: number
  percentage: number
}

export type BillingSummary = {
  pendingPlanChange?: Pick<
    BillingPlanChangeResult,
    "id" | "plan" | "cycle" | "status"
  > | null
  subscription: {
    id: string
    plan: "STARTER" | "GROWTH" | "BUSINESS"
    cycle: "MONTHLY" | "ANNUAL"
    status: BillingSubscriptionStatus
    active: boolean
    managedByPaddle: boolean
    recovery: {
      awaitingRenewal: boolean
      graceEndsAt: string | null
      paymentIssue: boolean
      lastCheckedAt: string | null
      checkDelayed: boolean
      checkoutPending: boolean
    }
    trialEndsAt: string | null
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  }
  entitlements: {
    monthlyAiQuestions: number
    stores: number
    members: number
    activeProducts: number
    providerKeys: readonly string[]
    aiDrafts: boolean
    safeAutoSend: boolean
    aiPerformance: boolean
  }
  usage: {
    questions: BillingCapacityUsage
    stores: BillingCapacityUsage
    members: BillingCapacityUsage
    activeProducts: BillingCapacityUsage
  }
}

export type BillingPlanChangeResult = {
  id: string
  status:
    | "PREVIEWED"
    | "PROCESSING"
    | "AWAITING_WEBHOOK"
    | "COMPLETED"
    | "FAILED"
    | "REVIEW_REQUIRED"
  plan: BillingSummary["subscription"]["plan"]
  cycle: BillingSummary["subscription"]["cycle"]
  failureCode?: string | null
  completedAt?: string | null
}

export type BillingPlanChangePreview = {
  id: string
  plan: BillingSummary["subscription"]["plan"]
  cycle: BillingSummary["subscription"]["cycle"]
  currentPlan: BillingSummary["subscription"]["plan"]
  currentCycle: BillingSummary["subscription"]["cycle"]
  effectiveFrom: "immediately"
  expiresAt: string
  canConfirm: boolean
  amounts: {
    currency: string
    credit: string
    charge: string
    difference: string
    differenceAction: "credit" | "charge"
    dueNow: string
    taxNow: string
    nextTotal: string
    recurringTotal: string
    nextBilledAt: string
  }
  capacity: Array<{ key: string; label: string; used: number; limit: number }>
  questions: { used: number; limit: number; resetsAt: string }
}

export type BillingCheckoutResult = {
  state: "ready" | "preparing" | "payment_pending" | "plan_conflict"
  transactionId: string | null
  environment: "sandbox" | "production"
  plan: BillingSummary["subscription"]["plan"]
  cycle: BillingSummary["subscription"]["cycle"]
}

export type InvoiceStatus = "paid" | "partially_refunded" | "refunded"

export type BillingPaymentMethod = {
  type: string
  brand: string | null
  last4: string | null
  expiryMonth: number | null
  expiryYear: number | null
}

export type BillingCustomer = {
  name: string | null
  email: string | null
  taxIdentifier: string | null
  address: string | null
}

export type InvoiceRecord = {
  id: string
  transactionId: string
  number: string
  plan: "STARTER" | "GROWTH" | "BUSINESS" | null
  cycle: "MONTHLY" | "ANNUAL" | null
  periodStart: string | null
  periodEnd: string | null
  issuedAt: string
  subtotal: number
  tax: number
  total: number
  refundedAmount: number
  currency: string
  status: InvoiceStatus
  paymentMethod: BillingPaymentMethod | null
  billingCustomer: BillingCustomer | null
}

export type BillingHistory = {
  managedByPaddle: boolean
  paymentMethod: BillingPaymentMethod | null
  billingCustomer: BillingCustomer | null
  invoices: InvoiceRecord[]
}

export type BillingPortalSession = {
  overviewUrl: string
  updatePaymentMethodUrl: string | null
  cancelSubscriptionUrl: string | null
}
export type BillingWorkspace = { id: string; name: string }
