import type { AdminBillingPlan } from "@/types/admin-billing"
import type {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support"

export type AdminOverview = {
  metrics: {
    customers: {
      totalUsers: number
      newUsersLast30Days: number
      totalWorkspaces: number
      newWorkspacesLast30Days: number
      activeStores: number
    }
    subscriptions: {
      total: number
      trialing: number
      active: number
      pastDue: number
      paused: number
      canceled: number
      expired: number
    }
    aiUsage: {
      last30Days: number
      previous30Days: number
      changePercentage: number | null
    }
    support: {
      open: number
      highPriority: number
      overdueFirstResponse: number
    }
    operations: {
      running: number
      failedLast24Hours: number
      stale: number
    }
    audit: {
      failuresLast24Hours: number
    }
  }
  attention: {
    paymentIssues: Array<{
      workspaceId: string
      workspaceName: string
      ownerName: string
      ownerEmail: string
      plan: AdminBillingPlan
      currentPeriodEnd: string
      reconcileFailures: number
      reconcileErrorCode: string | null
    }>
    supportTickets: Array<{
      id: string
      number: number
      subject: string
      status: SupportTicketStatus
      priority: SupportTicketPriority
      firstResponseDueAt: string
      firstRespondedAt: string | null
      lastMessageAt: string
      workspace: { id: string; name: string }
      isFirstResponseOverdue: boolean
    }>
    failedSyncs: Array<{
      id: string
      kind: "FULL" | "INVENTORY" | "QUESTION"
      providerKey: string
      store: {
        id: string
        name: string
        workspace: { id: string; name: string }
      }
      errorMessage: string | null
      completedAt: string | null
    }>
  }
  recentAuditEvents: Array<{
    id: string
    actorType: "USER" | "ADMIN" | "SYSTEM"
    actorUserId: string | null
    actor: { id: string; name: string; email: string } | null
    origin: "API" | "WORKER" | "WEBHOOK" | "SCHEDULED" | "SYSTEM"
    action: string
    result: "STARTED" | "SUCCESS" | "FAILURE"
    workspaceId: string | null
    workspace: { id: string; name: string } | null
    targetType: string | null
    targetId: string | null
    errorCode: string | null
    createdAt: string
  }>
  generatedAt: string
}
