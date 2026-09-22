import { apiFetch } from "@/lib/api/client"
import type { AdminSearchResponse } from "@/types/admin-search"

export function searchAdmin(query: string, signal?: AbortSignal, limit = 5) {
  const params = new URLSearchParams({ query, limit: String(limit) })
  return apiFetch<AdminSearchResponse>(`/admin/search?${params.toString()}`, {
    signal,
  })
}
