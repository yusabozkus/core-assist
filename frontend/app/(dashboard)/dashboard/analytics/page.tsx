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
  const providerValue = firstValue(params.provider)
  const provider =
    providerValue && /^[a-z0-9_-]{1,50}$/.test(providerValue)
      ? providerValue
      : "ALL"
  const storeContext = await getOperationalStoreContext()
  const performance = await getServerAiPerformance(
    storeContext.activeStore.id,
    { range, provider: provider === "ALL" ? undefined : provider }
  ).catch(() => null)

  return (
    <AnalyticsClient
      activeStore={storeContext.activeStore}
      performance={performance}
      range={range}
      provider={provider}
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
