export type InventoryStockFilter =
  "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE"

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
  providers: string[]
}

export type InventorySummary = {
  variants: number
  healthy: number
  lowStock: number
  outOfStock: number
  unavailable: number
  totalStock: number
  lastSyncedAt: string | null
}

export type InventoryPage = {
  items: InventoryItem[]
  nextCursor: string | null
  total: number
  variantTotal: number
  lowStockThreshold: number
  providers: string[]
  summary: InventorySummary
}
