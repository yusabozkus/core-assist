import { apiFetch } from "@/lib/api/client"
import type { GlobalSearchResponse } from "@/types/search"

export function globalSearch(
  storeId: string,
  query: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ query, limit: "5" })

  return apiFetch<GlobalSearchResponse>(
    `/stores/${storeId}/search?${params.toString()}`,
    { signal }
  )
}
