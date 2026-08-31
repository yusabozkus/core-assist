import { apiFetch } from "@/lib/api/client"
import type {
  CatalogSyncResult,
  ChannelConnection,
  IntegrationEnvironment,
} from "@/types/channel"
import type {
  SyncHistoryKindFilter,
  SyncHistoryPage,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

type SyncHistoryOptions = {
  cursor?: string | null
  status?: SyncHistoryStatusFilter
  kind?: SyncHistoryKindFilter
  provider?: string
  limit?: number
  signal?: AbortSignal
}

export function getChannelSyncHistory(
  storeId: string,
  {
    cursor,
    status = "ALL",
    kind = "ALL",
    provider,
    limit = 20,
    signal,
  }: SyncHistoryOptions = {}
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    status,
    kind,
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (provider && provider !== "ALL") searchParams.set("provider", provider)

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
