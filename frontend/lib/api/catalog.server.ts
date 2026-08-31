import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { CatalogProductPage } from "@/types/product"
import type { InventoryPage } from "@/types/inventory"

const CATALOG_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

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

    const response = await fetch(
      `${apiUrl}/stores/${storeId}/catalog/products?limit=12`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          cookie,
        },
        signal: AbortSignal.timeout(CATALOG_REQUEST_TIMEOUT_MS),
      }
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
  async (storeId: string): Promise<InventoryPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return emptyInventoryPage()
    }

    const response = await fetch(
      `${apiUrl}/stores/${storeId}/catalog/inventory?limit=20`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          cookie,
        },
        signal: AbortSignal.timeout(CATALOG_REQUEST_TIMEOUT_MS),
      }
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
    providers: [],
    summary: {
      variants: 0,
      healthy: 0,
      lowStock: 0,
      outOfStock: 0,
      unavailable: 0,
      totalStock: 0,
      lastSyncedAt: null,
    },
  }
}
