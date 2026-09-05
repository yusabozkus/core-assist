import { apiFetch } from "@/lib/api/client"
import type { DashboardOverview, DashboardRange } from "@/types/dashboard"

export function getDashboardOverview(
  storeId: string,
  range: DashboardRange,
  signal?: AbortSignal
) {
  return apiFetch<DashboardOverview>(
    `/stores/${storeId}/dashboard?range=${range}`,
    { signal, cache: "no-store" }
  )
}
