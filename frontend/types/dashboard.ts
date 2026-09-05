export type DashboardRange = "7D" | "30D"
export type DashboardQueueState =
  "FAILED" | "PROCESSING" | "UNMATCHED" | "REVIEW" | "READY" | "PENDING"

export type DashboardOverview = {
  storeId: string
  generatedAt: string
  period: {
    range: DashboardRange
    days: number
    timezone: string
    from: string
    to: string
    previousFrom: string
    previousTo: string
  }
  metrics: {
    incoming: number
    previousIncoming: number
    answered: number
    previousAnswered: number
    averageResponseMinutes: number | null
  }
  activity: Array<{ date: string; incoming: number; answered: number }>
  queue: { total: number; counts: Record<DashboardQueueState, number> }
  automationMode: "OFF" | "SHADOW" | "SAFE_AUTO"
  priorityQuestions: Array<{
    id: string
    question: string
    customerName: string | null
    productTitle: string | null
    providerKey: string
    externalCreatedAt: string
    state: DashboardQueueState
  }>
  channels: Array<{
    id: string
    providerKey: string
    status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"
    lastSyncAt: string | null
    lastInventorySyncAt: string | null
    lastQuestionSyncAt: string | null
    processingStartedAt: string | null
    questionSyncStartedAt: string | null
    hasError: boolean
    latestSync: {
      id: string
      status: "RUNNING" | "COMPLETED" | "FAILED"
      kind: "FULL" | "INVENTORY" | "QUESTION"
      startedAt: string
    } | null
  }>
  catalog: {
    products: number
    variants: number
    lowStock: number
    outOfStock: number
    stale: number
    freshnessMinutes: number
    lowStockThreshold: number
  }
  popularProducts: Array<{
    id: string
    title: string
    brand: string | null
    imageUrl: string | null
    questions: number
  }>
}

export function parseDashboardRange(
  value: string | string[] | undefined
): DashboardRange {
  return (Array.isArray(value) ? value[0] : value) === "30D" ? "30D" : "7D"
}
