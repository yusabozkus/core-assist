import { getServerAiPerformance } from "@/lib/api/ai-performance.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import type { AiPerformanceRange } from "@/types/ai-performance"

import { AnalyticsClient } from "./analytics-client"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const range = parseRange(firstValue(params.range))
  const storeContext = await getOperationalStoreContext()
  const performance = await getServerAiPerformance(
    storeContext.activeStore.id,
    { range }
  ).catch(() => null)

  return (
    <AnalyticsClient
      activeStore={storeContext.activeStore}
      performance={performance}
      range={range}
    />
  )
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseRange(value?: string): AiPerformanceRange {
  return ["7D", "30D", "90D", "ALL"].includes(value ?? "")
    ? (value as AiPerformanceRange)
    : "30D"
}
