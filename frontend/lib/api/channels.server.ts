import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { ChannelConnection, IntegrationProvider } from "@/types/channel"
import type { SyncHistoryPage } from "@/types/sync-history"
import type {
  SyncHistoryKindFilter,
  SyncHistoryOrder,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

const CHANNELS_REQUEST_TIMEOUT_MS = 8_000

export const getServerChannelConnections = cache(
  async (storeId: string): Promise<ChannelConnection[]> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return []
    }

    const response = await fetchServerApi(`/stores/${storeId}/channels`, {
      cookie,
      timeoutMs: CHANNELS_REQUEST_TIMEOUT_MS,
    })

    if (!response.ok) {
      throw new Error(
        `Channel connections request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as ChannelConnection[]
  }
)

export const getServerIntegrationProviders = cache(
  async (storeId: string): Promise<IntegrationProvider[]> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return []
    }

    const response = await fetchServerApi(
      `/stores/${storeId}/channels/providers/available`,
      { cookie, timeoutMs: CHANNELS_REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `Integration providers request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as IntegrationProvider[]
  }
)

export const getServerChannelSyncHistory = cache(
  async (
    storeId: string,
    options: {
      status?: SyncHistoryStatusFilter
      kind?: SyncHistoryKindFilter
      provider?: string
      order?: SyncHistoryOrder
      from?: string
    } = {}
  ): Promise<SyncHistoryPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) return emptySyncHistoryPage()

    const searchParams = new URLSearchParams({
      limit: "20",
      status: options.status ?? "ALL",
      kind: options.kind ?? "ALL",
      order: options.order ?? "NEWEST",
    })
    if (options.provider && options.provider !== "ALL") {
      searchParams.set("provider", options.provider)
    }
    if (options.from) searchParams.set("from", options.from)

    const response = await fetchServerApi(
      `/stores/${storeId}/channels/sync-runs?${searchParams.toString()}`,
      { cookie, timeoutMs: CHANNELS_REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `Channel sync history request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as SyncHistoryPage
  }
)

function emptySyncHistoryPage(): SyncHistoryPage {
  return {
    items: [],
    nextCursor: null,
    total: 0,
    providers: [],
    providerHealth: [],
    summary: {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
      successRate: null,
      lastSuccessfulAt: null,
    },
  }
}
