import type { IntegrationEnvironment } from "@/types/channel"

export type SyncHistoryStatus = "RUNNING" | "COMPLETED" | "FAILED"
export type SyncHistoryStatusFilter = "ALL" | SyncHistoryStatus
export type SyncHistoryKind = "FULL" | "INVENTORY" | "QUESTION"
export type SyncHistoryKindFilter = "ALL" | SyncHistoryKind

export type SyncHistoryItem = {
  id: string
  kind: SyncHistoryKind
  status: SyncHistoryStatus
  productsProcessed: number
  variantsProcessed: number
  questionsProcessed: number
  productsArchived: number
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
}

export type SyncHistoryPage = {
  items: SyncHistoryItem[]
  nextCursor: string | null
  total: number
  providers: string[]
  summary: SyncHistorySummary
}
