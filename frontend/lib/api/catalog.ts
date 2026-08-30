import { apiFetch } from "@/lib/api/client"
import type { CatalogProduct, CatalogProductPage } from "@/types/product"

type CatalogProductsOptions = {
  cursor?: string | null
  query?: string
  limit?: number
  signal?: AbortSignal
}

export function getCatalogProducts(
  storeId: string,
  { cursor, query, limit = 12, signal }: CatalogProductsOptions = {}
) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())

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
