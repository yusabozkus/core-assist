import { apiFetch } from "@/lib/api/client"
import type { ChannelConnection, ChannelProvider } from "@/types/channel"

export function createChannelConnection(
  storeId: string,
  input: { provider: ChannelProvider }
) {
  return apiFetch<ChannelConnection>(`/stores/${storeId}/channels`, {
    method: "POST",
    body: JSON.stringify(input),
  })
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
