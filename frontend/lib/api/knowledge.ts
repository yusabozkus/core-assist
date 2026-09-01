import { apiFetch } from "@/lib/api/client"
import type {
  StoreKnowledge,
  UpdateStoreKnowledgePayload,
} from "@/types/knowledge"

export function updateStoreKnowledge(
  storeId: string,
  payload: UpdateStoreKnowledgePayload
) {
  return apiFetch<StoreKnowledge>(`/stores/${storeId}/knowledge`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}
