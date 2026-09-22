import "server-only"

import { headers } from "next/headers"

import type {
  AdminAiBlockerList,
  AdminAiBlockerType,
  AdminAiUsage,
  AdminAiUsagePeriod,
} from "@/types/admin-ai-usage"
import type { AdminSystemHealth } from "@/types/admin-system-health"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export function getServerAdminAiUsage(period: AdminAiUsagePeriod) {
  return adminInsightsFetch<AdminAiUsage>(
    `/admin/ai-usage?period=${encodeURIComponent(period)}`
  )
}

export function getServerAdminAiBlockers(
  type: AdminAiBlockerType,
  page: number,
  pageSize = 25
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return adminInsightsFetch<AdminAiBlockerList>(
    `/admin/ai-usage/blockers/${encodeURIComponent(type)}?${params}`
  )
}

export function getServerAdminSystemHealth() {
  return adminInsightsFetch<AdminSystemHealth>("/admin/system-health")
}

async function adminInsightsFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin insights requires an authenticated session.")
  }

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Admin insights request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
