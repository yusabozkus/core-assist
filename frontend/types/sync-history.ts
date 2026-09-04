import type {
  ChannelConnectionStatus,
  IntegrationEnvironment,
} from "@/types/channel"

export type SyncHistoryStatus = "RUNNING" | "COMPLETED" | "FAILED"
export type SyncHistoryStatusFilter = "ALL" | SyncHistoryStatus
export type SyncHistoryKind = "FULL" | "INVENTORY" | "QUESTION"
export type SyncHistoryKindFilter = "ALL" | SyncHistoryKind
export type SyncHistoryOrder = "NEWEST" | "OLDEST"
export type SyncHistoryPeriod = "ALL" | "24H" | "7D" | "30D" | "90D"
export type SyncHistoryTrigger = "MANUAL" | "SCHEDULED" | "RETRY" | "ONBOARDING"
export type SyncHistoryStage =
  "QUEUED" | "FETCHING" | "PERSISTING" | "RECONCILING" | "COMPLETED" | "FAILED"

export type SyncHistoryItem = {
  id: string
  kind: SyncHistoryKind
  status: SyncHistoryStatus
  trigger: SyncHistoryTrigger
  stage: SyncHistoryStage
  progress: number
  retryOfId: string | null
  productsProcessed: number
  variantsProcessed: number
  questionsProcessed: number
  productsArchived: number
  productsCreated: number
  productsUpdated: number
  productsUnchanged: number
  variantsUpdated: number
  variantsUnchanged: number
  questionsUnchanged: number
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  connectionId: string
  providerKey: string
  environment: IntegrationEnvironment
}

export type SyncHistorySummary = {
  total: number
  running: number
  completed: number
  failed: number
  successRate: number | null
  lastSuccessfulAt: string | null
}

export type SyncHistoryPage = {
  items: SyncHistoryItem[]
  nextCursor: string | null
  total: number
  providers: string[]
  providerHealth: SyncProviderHealth[]
  summary: SyncHistorySummary
}

export type SyncProviderHealth = {
  providerKey: string
  connectionStatus: ChannelConnectionStatus
  failureReason: string | null
  lastRun: Pick<
    SyncHistoryItem,
    "id" | "kind" | "status" | "startedAt" | "completedAt"
  > | null
}
