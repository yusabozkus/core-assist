import "server-only"

import { headers } from "next/headers"
import type { DashboardOverview, DashboardRange } from "@/types/dashboard"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export async function getServerDashboardOverview(
  storeId: string,
  range: DashboardRange
): Promise<DashboardOverview> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Dashboard requires an authenticated session.")

  const response = await fetch(
    `${apiUrl}/stores/${storeId}/dashboard?range=${range}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!response.ok)
    throw new Error(`Dashboard request failed with status ${response.status}.`)
  return response.json() as Promise<DashboardOverview>
}
