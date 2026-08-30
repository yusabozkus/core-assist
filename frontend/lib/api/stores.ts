import { apiFetch } from "@/lib/api/client"
import type { StoreSummary } from "@/types/store"

export function createStore(input: { name: string }) {
  return apiFetch<StoreSummary>("/stores", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type ArchiveStoreResult = {
  archived: true
  archivedStoreId: string
}

export function archiveStore(storeId: string) {
  return apiFetch<ArchiveStoreResult>(`/stores/${storeId}/archive`, {
    method: "PATCH",
  })
}

export function restoreStore(storeId: string) {
  return apiFetch<StoreSummary>(`/stores/${storeId}/restore`, {
    method: "PATCH",
  })
}
