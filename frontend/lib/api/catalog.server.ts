import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { CatalogProductPage } from "@/types/product"
import type { InventoryPage, InventoryStockFilter } from "@/types/inventory"

const CATALOG_REQUEST_TIMEOUT_MS = 8_000

export const getServerCatalogProducts = cache(
  async (storeId: string): Promise<CatalogProductPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return {
        items: [],
        nextCursor: null,
        total: 0,
        summary: { products: 0, variants: 0, totalStock: 0 },
      }
    }

    const response = await fetchServerApi(
      `/stores/${storeId}/catalog/products?limit=12`,
      { cookie, timeoutMs: CATALOG_REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `Catalog products request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as CatalogProductPage
  }
)

export const getServerCatalogInventory = cache(
  async (
    storeId: string,
    options: {
      query?: string
      status?: InventoryStockFilter
      provider?: string
      lowStockThreshold?: number
    } = {}
  ): Promise<InventoryPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return emptyInventoryPage()
    }

    const searchParams = new URLSearchParams({
      limit: "20",
      status: options.status ?? "ALL",
      lowStockThreshold: String(options.lowStockThreshold ?? 5),
    })
    if (options.query?.trim()) searchParams.set("query", options.query.trim())
    if (options.provider && options.provider !== "ALL") {
      searchParams.set("provider", options.provider)
    }

    const response = await fetchServerApi(
      `/stores/${storeId}/catalog/inventory?${searchParams.toString()}`,
      { cookie, timeoutMs: CATALOG_REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `Catalog inventory request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as InventoryPage
  }
)

function emptyInventoryPage(): InventoryPage {
  return {
    items: [],
    nextCursor: null,
    total: 0,
    variantTotal: 0,
    lowStockThreshold: 5,
    freshnessMaxAgeMs: 15 * 60 * 1_000,
    providers: [],
    inventoryPolicy: "SHARED",
    summary: {
      variants: 0,
      healthy: 0,
      lowStock: 0,
      outOfStock: 0,
      unavailable: 0,
      stale: 0,
      totalStock: 0,
      lastSyncedAt: null,
    },
  }
}
