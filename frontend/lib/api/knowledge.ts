import { apiFetch } from "@/lib/api/client"
import type {
  StoreKnowledge,
  UpdateStoreKnowledgePayload,
} from "@/types/knowledge"

export function getStoreKnowledge(storeId: string, signal?: AbortSignal) {
  return apiFetch<StoreKnowledge>(`/stores/${storeId}/knowledge`, {
    cache: "no-store",
    signal,
  })
}

export function updateStoreKnowledge(
  storeId: string,
  payload: UpdateStoreKnowledgePayload
) {
  return apiFetch<StoreKnowledge>(`/stores/${storeId}/knowledge`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}
