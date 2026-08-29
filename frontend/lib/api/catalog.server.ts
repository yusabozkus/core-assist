import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { CatalogProduct } from "@/types/product"

const CATALOG_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerCatalogProducts = cache(
  async (storeId: string): Promise<CatalogProduct[]> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return []
    }

    const response = await fetch(
      `${apiUrl}/stores/${storeId}/catalog/products`,
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

    return (await response.json()) as CatalogProduct[]
  }
)
