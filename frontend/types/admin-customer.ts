import type { BillingSubscriptionStatus, BillingSummary } from "@/types/billing"
import type {
  ChannelConnectionStatus,
  IntegrationEnvironment,
} from "@/types/channel"
import type {
  SyncHistoryKind,
  SyncHistoryStage,
  SyncHistoryStatus,
  SyncHistoryTrigger,
} from "@/types/sync-history"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support"

export type AdminCustomerPlan = BillingSummary["subscription"]["plan"]
export type AdminCustomerCycle = BillingSummary["subscription"]["cycle"]

export type AdminCustomerPerson = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  onboardingCompletedAt: string | null
  createdAt: string
}

export type AdminCustomerSummary = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  owner: AdminCustomerPerson
  onboardingCompleted: boolean
  lastActiveAt: string | null
  subscription: {
    plan: AdminCustomerPlan
    cycle: AdminCustomerCycle
    status: BillingSubscriptionStatus
    currentPeriodStart: string
    currentPeriodEnd: string
    trialEndsAt: string | null
    cancelAtPeriodEnd: boolean
    scheduledAccessEndsAt: string | null
    hasAccess: boolean
  } | null
  usage: {
    aiQuestions: number
    periodStart: string
    periodEnd: string
  } | null
  limits: {
    aiQuestions: number
    stores: number
    members: number
    activeProducts: number
  } | null
  counts: {
    members: number
    stores: number
    activeStores: number
    activeProducts: number
    openSupportTickets: number
  }
}

export type AdminCustomerList = {
  items: AdminCustomerSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    total: number
    active: number
    trialing: number
    paymentIssues: number
    pending: number
  }
}

export type AdminCustomerQuery = {
  q?: string
  plan?: AdminCustomerPlan
  subscription?: BillingSubscriptionStatus | "NONE"
  onboarding?: "COMPLETED" | "PENDING"
  sort?: "NEWEST" | "OLDEST" | "NAME"
  page?: number
  pageSize?: number
}

export type AdminCustomerDetail = AdminCustomerSummary & {
  owner: AdminCustomerPerson & { providers: string[] }
  members: Array<{
    id: string
    role: "OWNER" | "ADMIN" | "MEMBER"
    joinedAt: string
    user: AdminCustomerPerson & {
      providers: string[]
      lastActiveAt: string | null
    }
  }>
  pendingInvitations: Array<{
    id: string
    email: string
    role: "OWNER" | "ADMIN" | "MEMBER"
    expiresAt: string
    createdAt: string
  }>
  stores: Array<{
    id: string
    name: string
    status: "ACTIVE" | "INACTIVE"
    inventoryPolicy: "SHARED" | "CHANNEL_SPECIFIC" | null
    createdAt: string
    updatedAt: string
    channels: Array<{
      id: string
      providerKey: string
      environment: IntegrationEnvironment
      status: ChannelConnectionStatus
      connectedAt: string | null
      lastSyncAt: string | null
      lastInventorySyncAt: string | null
      lastQuestionSyncAt: string | null
      failureReason: string | null
      questionSyncFailureReason: string | null
    }>
    counts: {
      products: number
      questions: number
      supportTickets: number
    }
  }>
  questionCounts: {
    total: number
    pending: number
    drafted: number
    answered: number
    ignored: number
  }
  recentSupportTickets: Array<{
    id: string
    number: number
    code: string
    subject: string
    category: SupportTicketCategory
    priority: SupportTicketPriority
    status: SupportTicketStatus
    messageCount: number
    createdAt: string
    updatedAt: string
  }>
  recentSyncRuns: Array<{
    id: string
    kind: SyncHistoryKind
    status: SyncHistoryStatus
    stage: SyncHistoryStage
    trigger: SyncHistoryTrigger
    progress: number
    productsProcessed: number
    questionsProcessed: number
    errorMessage: string | null
    startedAt: string
    completedAt: string | null
    connection: {
      providerKey: string
      store: { id: string; name: string }
    }
  }>
}
