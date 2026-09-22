import type {
  SyncHistoryKind,
  SyncHistoryStage,
  SyncHistoryStatus,
  SyncHistoryTrigger,
} from "@/types/sync-history"
import type {
  ChannelConnectionStatus,
  IntegrationEnvironment,
} from "@/types/channel"

export type AdminOperationQueue = {
  key: string
  label: string
  available: boolean
  errorCode: string | null
  paused: boolean
  recentFailuresLast24Hours: number
  workerCount: number | null
  workerUnavailable: boolean
  oldestWaitingAgeMs: number | null
  longestActiveAgeMs: number | null
  waitingAgeWarningMs: number
  activeDurationWarningMs: number
  activeStallWarningMs: number
  waitingAgeExceeded: boolean
  activeDurationExceeded: boolean
  stalledActiveJobs: number
  counts: {
    waiting: number
    active: number
    scheduled: number
    overdue: number
    failed: number
  }
}

export type AdminOperationScheduledJob = {
  id: string
  name: string
  kind: "RECURRING" | "RETRY" | "DELAYED"
  createdAt: string
  scheduledFor: string
  overdue: boolean
  overdueByMs: number
  attemptsMade: number
  maxAttempts: number
  recurrence: {
    everyMs: number | null
    pattern: string | null
    timezone: string | null
  } | null
}

export type AdminOperationQueueFailure = {
  id: string
  name: string
  failedReason: string
  attemptsMade: number
  failedAt: string
}

export type AdminOperationQueueDetail = AdminOperationQueue & {
  scheduledJobs: AdminOperationScheduledJob[]
  failures: AdminOperationQueueFailure[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  generatedAt: string
}

export type AdminOperation = {
  id: string
  kind: SyncHistoryKind
  status: SyncHistoryStatus
  trigger: SyncHistoryTrigger
  stage: SyncHistoryStage
  progress: number
  retryOfId: string | null
  metrics: {
    productsProcessed: number
    productsCreated: number
    productsUpdated: number
    productsUnchanged: number
    productsSkipped: number
    productsArchived: number
    batchesProcessed: number
    variantsProcessed: number
    variantsUpdated: number
    variantsUnchanged: number
    questionsProcessed: number
    questionsUnchanged: number
    lowStockAlerts: number
    outOfStockAlerts: number
  }
  fetchCompleted: boolean
  cursor: string | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  updatedAt: string
  durationMs: number
  isStale: boolean
  canRetry: boolean
  retryBlockedReason: string | null
  connection: {
    id: string
    providerKey: string
    environment: IntegrationEnvironment
    status: ChannelConnectionStatus
    failureReason: string | null
  }
  store: {
    id: string
    name: string
    status: "ACTIVE" | "INACTIVE"
    workspace: {
      id: string
      name: string
      owner: { name: string; email: string }
    }
  }
}

export type AdminOperationsPage = {
  items: AdminOperation[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    total: number
    running: number
    failedLastDay: number
    staleRunning: number
    unhealthyConnections: number
    successRateLastDay: number | null
    queueBacklog: number | null
    unavailableQueues: number
  }
  providers: string[]
  queues: AdminOperationQueue[]
  generatedAt: string
}

export type AdminOperationsQuery = {
  q?: string
  status?: SyncHistoryStatus
  kind?: SyncHistoryKind
  provider?: string
  environment?: IntegrationEnvironment
  issue?: "STALE" | "CONNECTION"
  period?: "24H" | "7D" | "30D"
  order?: "NEWEST" | "OLDEST"
  page?: number
  pageSize?: number
}

export type AdminOperationRetryResult = {
  syncRunId: string
  status: "RUNNING"
}
