export type InventoryStockFilter =
  "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE" | "STALE"

export type InventoryFreshness = "FRESH" | "STALE" | "UNKNOWN"

export type InventorySort =
  "CRITICAL_FIRST" | "STOCK_ASC" | "STOCK_DESC" | "RECENTLY_UPDATED"

export type InventoryItem = {
  id: string
  productId: string
  productTitle: string
  productBrand: string | null
  productCategory: string | null
  imageUrl: string | null
  title: string | null
  sku: string
  barcode: string | null
  color: string | null
  size: string | null
  price: number
  currency: string
  stock: number
  status: "ACTIVE" | "OUT_OF_STOCK" | "UNAVAILABLE" | "ARCHIVED"
  sourceUpdatedAt: string | null
  lastSyncedAt: string | null
  freshness: InventoryFreshness
  providers: string[]
  channelStocks: Array<{
    providerKey: string
    stock: number
    lastSyncedAt: string
  }>
  hasStockConflict: boolean
}

export type InventorySummary = {
  variants: number
  healthy: number
  lowStock: number
  outOfStock: number
  unavailable: number
  stale: number
  totalStock: number
  lastSyncedAt: string | null
}

export type InventoryPage = {
  items: InventoryItem[]
  nextCursor: string | null
  total: number
  variantTotal: number
  lowStockThreshold: number
  freshnessMaxAgeMs: number
  providers: string[]
  inventoryPolicy: "SHARED" | "CHANNEL_SPECIFIC"
  summary: InventorySummary
}
