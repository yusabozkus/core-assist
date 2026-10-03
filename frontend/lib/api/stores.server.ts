import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { StoreSummary } from "@/types/store"

const STORES_REQUEST_TIMEOUT_MS = 8_000

export const getServerStores = cache(async (): Promise<StoreSummary[]> => {
  return getStores("/stores")
})

async function getStores(path: string): Promise<StoreSummary[]> {
  const cookie = (await headers()).get("cookie")

  if (!cookie) {
    return []
  }

  const response = await fetchServerApi(path, {
    cookie,
    timeoutMs: STORES_REQUEST_TIMEOUT_MS,
  })

  if (!response.ok) {
    throw new Error(
      `Stores request to ${path} failed with status ${response.status}.`
    )
  }

  return (await response.json()) as StoreSummary[]
}
