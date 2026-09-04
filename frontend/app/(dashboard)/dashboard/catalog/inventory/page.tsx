import { InventoryManagement } from "./inventory-management"
import { getServerCatalogInventory } from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import type { InventorySort, InventoryStockFilter } from "@/types/inventory"

export const dynamic = "force-dynamic"

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { activeStore } = await getOperationalStoreContext()
  const params = await searchParams
  const initialFilters = {
    query: firstValue(params.q)?.slice(0, 100) ?? "",
    status: parseStatus(firstValue(params.status)),
    provider: firstValue(params.provider)?.slice(0, 50) || "ALL",
    lowStockThreshold: parseThreshold(firstValue(params.threshold)),
    sort: parseSort(firstValue(params.sort)),
  }
  const [initialPage, connections] = await Promise.all([
    getServerCatalogInventory(activeStore.id, initialFilters),
    getServerChannelConnections(activeStore.id),
  ])

  return (
    <InventoryManagement
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialPage={initialPage}
      initialFilters={initialFilters}
      connections={connections}
    />
  )
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseStatus(value?: string): InventoryStockFilter {
  const normalized = value?.toUpperCase()
  return normalized === "IN_STOCK" ||
    normalized === "LOW_STOCK" ||
    normalized === "OUT_OF_STOCK" ||
    normalized === "UNAVAILABLE" ||
    normalized === "STALE"
    ? normalized
    : "ALL"
}

function parseThreshold(value?: string) {
  const threshold = Number(value)
  return [3, 5, 10, 20].includes(threshold) ? threshold : 5
}

function parseSort(value?: string): InventorySort {
  const normalized = value?.toUpperCase()
  return normalized === "STOCK_ASC" ||
    normalized === "STOCK_DESC" ||
    normalized === "RECENTLY_UPDATED"
    ? normalized
    : "CRITICAL_FIRST"
}
