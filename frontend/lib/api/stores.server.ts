import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { StoreSummary } from "@/types/store"

const STORES_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerStores = cache(async (): Promise<StoreSummary[]> => {
  const cookie = (await headers()).get("cookie")

  if (!cookie) {
    return []
  }

  const response = await fetch(`${apiUrl}/stores`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      cookie,
    },
    signal: AbortSignal.timeout(STORES_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Stores request failed with status ${response.status}.`)
  }

  return (await response.json()) as StoreSummary[]
})
