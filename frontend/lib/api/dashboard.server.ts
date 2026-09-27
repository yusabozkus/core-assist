import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import type { DashboardOverview, DashboardRange } from "@/types/dashboard"

export async function getServerDashboardOverview(
  storeId: string,
  range: DashboardRange
): Promise<DashboardOverview> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Dashboard requires an authenticated session.")

  const response = await fetchServerApi(
    `/stores/${storeId}/dashboard?range=${range}`,
    { cookie, timeoutMs: 15_000 }
  )
  if (!response.ok)
    throw new Error(`Dashboard request failed with status ${response.status}.`)
  return response.json() as Promise<DashboardOverview>
}
