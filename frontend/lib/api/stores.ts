import { apiFetch } from "@/lib/api/client"
import type { StoreSummary } from "@/types/store"

export function createStore(input: { name: string }) {
  return apiFetch<StoreSummary>("/stores", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
