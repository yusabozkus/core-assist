import { apiFetch } from "@/lib/api/client"
import type {
  CatalogSyncResult,
  ChannelConnection,
  IntegrationEnvironment,
} from "@/types/channel"
import type {
  SyncHistoryItem,
  SyncHistoryKindFilter,
  SyncHistoryPage,
  SyncHistoryOrder,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

type SyncHistoryOptions = {
  cursor?: string | null
  status?: SyncHistoryStatusFilter
  kind?: SyncHistoryKindFilter
  provider?: string
  order?: SyncHistoryOrder
  from?: string
  limit?: number
  signal?: AbortSignal
}

export function getChannelConnections(storeId: string, signal?: AbortSignal) {
  return apiFetch<ChannelConnection[]>(`/stores/${storeId}/channels`, {
    signal,
  })
}

export function getChannelSyncRun(
  storeId: string,
  syncRunId: string,
  signal?: AbortSignal
) {
  return apiFetch<SyncHistoryItem>(
    `/stores/${storeId}/channels/sync-runs/${syncRunId}`,
    { signal }
  )
}

export function retryChannelSyncRun(storeId: string, syncRunId: string) {
  return apiFetch<{ syncRunId: string; status: "RUNNING" }>(
    `/stores/${storeId}/channels/sync-runs/${syncRunId}/retry`,
    { method: "POST" }
  )
}

export function getChannelSyncHistory(
  storeId: string,
  {
    cursor,
    status = "ALL",
    kind = "ALL",
    provider,
    order = "NEWEST",
    from,
    limit = 20,
    signal,
  }: SyncHistoryOptions = {}
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    status,
    kind,
    order,
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (provider && provider !== "ALL") searchParams.set("provider", provider)
  if (from) searchParams.set("from", from)

  return apiFetch<SyncHistoryPage>(
    `/stores/${storeId}/channels/sync-runs?${searchParams.toString()}`,
    { signal }
  )
}

export function createChannelConnection(
  storeId: string,
  input: {
    providerKey: string
    environment: IntegrationEnvironment
    credentials: Record<string, string>
  }
) {
  return apiFetch<ChannelConnection>(`/stores/${storeId}/channels`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function configureChannelConnection(
  storeId: string,
  connectionId: string,
  input: {
    environment: IntegrationEnvironment
    credentials: Record<string, string>
  }
) {
  return apiFetch<ChannelConnection>(
    `/stores/${storeId}/channels/${connectionId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  )
}

export function syncChannelCatalog(storeId: string, connectionId: string) {
  return apiFetch<CatalogSyncResult>(
    `/stores/${storeId}/channels/${connectionId}/sync`,
    { method: "POST" }
  )
}

export function syncChannelInventory(storeId: string, connectionId: string) {
  return apiFetch<CatalogSyncResult>(
    `/stores/${storeId}/channels/${connectionId}/inventory-sync`,
    { method: "POST" }
  )
}

export function disconnectChannelConnection(
  storeId: string,
  connectionId: string
) {
  return apiFetch<ChannelConnection>(
    `/stores/${storeId}/channels/${connectionId}/disconnect`,
    { method: "PATCH" }
  )
}

export function reconnectChannelConnection(
  storeId: string,
  connectionId: string
) {
  return apiFetch<ChannelConnection>(
    `/stores/${storeId}/channels/${connectionId}/reconnect`,
    { method: "PATCH" }
  )
}

export function removeChannelConnection(storeId: string, connectionId: string) {
  return apiFetch<{ deleted: true }>(
    `/stores/${storeId}/channels/${connectionId}`,
    { method: "DELETE" }
  )
}
