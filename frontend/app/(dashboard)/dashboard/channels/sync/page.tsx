import { SyncHistory } from "./sync-history"
import { getServerChannelSyncHistory } from "@/lib/api/channels.server"
import { getManagedOperationalStoreContext } from "@/lib/stores/active-store"
import type {
  SyncHistoryKindFilter,
  SyncHistoryOrder,
  SyncHistoryPeriod,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

export const dynamic = "force-dynamic"

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SyncHistoryPage({
  searchParams,
}: {
  searchParams: PageSearchParams
}) {
  const { activeStore } = await getManagedOperationalStoreContext()
  const params = await searchParams
  const status = parseStatus(firstValue(params.status))
  const kind = parseKind(firstValue(params.kind))
  const provider = firstValue(params.provider) || "ALL"
  const period = parsePeriod(firstValue(params.period))
  const order = parseOrder(firstValue(params.order))
  const initialPage = await getServerChannelSyncHistory(activeStore.id, {
    status,
    kind,
    provider,
    order,
    from: getPeriodStart(period),
  })

  return (
    <SyncHistory
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialPage={initialPage}
      initialFilters={{ status, kind, provider, period, order }}
    />
  )
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseStatus(value?: string): SyncHistoryStatusFilter {
  return ["RUNNING", "COMPLETED", "FAILED"].includes(value ?? "")
    ? (value as SyncHistoryStatusFilter)
    : "ALL"
}

function parseKind(value?: string): SyncHistoryKindFilter {
  return ["FULL", "INVENTORY", "QUESTION"].includes(value ?? "")
    ? (value as SyncHistoryKindFilter)
    : "ALL"
}

function parsePeriod(value?: string): SyncHistoryPeriod {
  return ["24H", "7D", "30D", "90D"].includes(value ?? "")
    ? (value as SyncHistoryPeriod)
    : "ALL"
}

function parseOrder(value?: string): SyncHistoryOrder {
  return value === "OLDEST" ? "OLDEST" : "NEWEST"
}

function getPeriodStart(period: SyncHistoryPeriod) {
  if (period === "ALL") return undefined

  const durations: Record<Exclude<SyncHistoryPeriod, "ALL">, number> = {
    "24H": 24 * 60 * 60 * 1_000,
    "7D": 7 * 24 * 60 * 60 * 1_000,
    "30D": 30 * 24 * 60 * 60 * 1_000,
    "90D": 90 * 24 * 60 * 60 * 1_000,
  }

  return new Date(Date.now() - durations[period]).toISOString()
}
