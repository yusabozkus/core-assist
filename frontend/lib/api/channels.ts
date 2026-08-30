import { apiFetch } from "@/lib/api/client"
import type {
  CatalogSyncResult,
  ChannelConnection,
  IntegrationEnvironment,
} from "@/types/channel"

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
