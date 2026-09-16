import { apiFetch } from "@/lib/api/client"
import type { InventoryPolicy, StoreSummary } from "@/types/store"

export function createStore(input: {
  name: string
  inventoryPolicy?: InventoryPolicy
}) {
  return apiFetch<StoreSummary>("/stores", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateStore(
  storeId: string,
  input: { name?: string; inventoryPolicy?: InventoryPolicy }
) {
  return apiFetch<StoreSummary>(`/stores/${storeId}`, {
    method: "PATCH",
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

export type DeleteStoreResult = {
  deleted: true
  deletedStoreId: string
  nextStore: StoreSummary | null
}

export function deleteStore(storeId: string, confirmation: string) {
  return apiFetch<DeleteStoreResult>(`/stores/${storeId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmation }),
  })
}
