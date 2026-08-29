import "server-only"

import { cookies } from "next/headers"
import { cache } from "react"

import { getServerStores } from "@/lib/api/stores.server"
import type { StoreSummary } from "@/types/store"

export const ACTIVE_STORE_COOKIE = "coreassist_active_store"

export type ActiveStoreContext = {
  stores: StoreSummary[]
  activeStore: StoreSummary | null
}

export const getActiveStoreContext = cache(
  async (): Promise<ActiveStoreContext> => {
    const [stores, cookieStore] = await Promise.all([
      getServerStores(),
      cookies(),
    ])
    const selectedStoreId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value
    const activeStore =
      stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null

    return { stores, activeStore }
  }
)
