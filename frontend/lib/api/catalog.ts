import { apiFetch } from "@/lib/api/client"
import type { InventoryPage, InventoryStockFilter } from "@/types/inventory"
import type { CatalogProduct, CatalogProductPage } from "@/types/product"

type CatalogProductsOptions = {
  cursor?: string | null
  query?: string
  provider?: string
  limit?: number
  signal?: AbortSignal
}

export function getCatalogProducts(
  storeId: string,
  { cursor, query, provider, limit = 12, signal }: CatalogProductsOptions = {}
) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())
  if (provider && provider !== "ALL") {
    searchParams.set("provider", provider)
  }

  return apiFetch<CatalogProductPage>(
    `/stores/${storeId}/catalog/products?${searchParams.toString()}`,
    { signal }
  )
}

export function getCatalogProduct(
  storeId: string,
  productId: string,
  signal?: AbortSignal
) {
  return apiFetch<CatalogProduct>(
    `/stores/${storeId}/catalog/products/${productId}`,
    { signal }
  )
}

type InventoryOptions = {
  cursor?: string | null
  query?: string
  status?: InventoryStockFilter
  provider?: string
  lowStockThreshold?: number
  limit?: number
  signal?: AbortSignal
}

export function getCatalogInventory(
  storeId: string,
  {
    cursor,
    query,
    status = "ALL",
    provider,
    lowStockThreshold = 5,
    limit = 20,
    signal,
  }: InventoryOptions = {}
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    status,
    lowStockThreshold: String(lowStockThreshold),
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())
  if (provider && provider !== "ALL") searchParams.set("provider", provider)

  return apiFetch<InventoryPage>(
    `/stores/${storeId}/catalog/inventory?${searchParams.toString()}`,
    { signal }
  )
}
