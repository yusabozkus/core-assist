import { apiFetch } from "@/lib/api/client"
import type { QuestionSyncResult } from "@/types/question"

export function syncStoreQuestions(storeId: string) {
  return apiFetch<QuestionSyncResult>(`/stores/${storeId}/questions/sync`, {
    method: "POST",
  })
}
