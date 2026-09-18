export type AdminHealthStatus = "HEALTHY" | "DEGRADED" | "DOWN"

export type AdminSystemQueue = {
  key: string
  label: string
  available: boolean
  paused: boolean
  counts: {
    waiting: number
    active: number
    delayed: number
    failed: number
  }
}

export type AdminSystemHealth = {
  status: AdminHealthStatus
  services: {
    api: { status: AdminHealthStatus }
    database: {
      status: AdminHealthStatus
      latencyMs: number | null
      errorCode: string | null
    }
    redis: {
      status: AdminHealthStatus
      latencyMs: number | null
      errorCode: string | null
    }
  }
  queues: AdminSystemQueue[]
  summary: {
    queueBacklog: number
    unavailableQueues: number
    pausedQueues: number
    retainedQueueFailures: number
    connectionIssues: number
    billingIssues: number
  }
  billing: {
    lastWebhook: {
      eventType: string
      occurredAt: string
      processedAt: string
    } | null
    webhookEventsLast24Hours: number
    webhookFailuresLast24Hours: number
    overdueReconciliations: number
    reconciliationFailures: number
  }
  marketplaces: {
    issueCount: number
    providers: Array<{
      providerKey: string
      total: number
      connected: number
      pending: number
      issues: number
    }>
    issues: Array<{
      id: string
      providerKey: string
      status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"
      failureReason: string | null
      questionSyncFailureReason: string | null
      updatedAt: string
      store: {
        id: string
        name: string
        workspace: { id: string; name: string }
      }
    }>
  }
  syncs: {
    completedLast24Hours: number
    failedLast24Hours: number
    running: number
  }
  recentErrors: Array<{
    id: string
    action: string
    origin: "API" | "WORKER" | "WEBHOOK" | "SCHEDULED" | "SYSTEM"
    workspaceId: string | null
    storeId: string | null
    targetType: string | null
    targetId: string | null
    errorCode: string | null
    createdAt: string
  }>
  generatedAt: string
}
