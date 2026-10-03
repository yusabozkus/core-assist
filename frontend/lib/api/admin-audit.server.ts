import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"

import type {
  AdminAuditLogsPage,
  AdminAuditLogsQuery,
} from "@/types/admin-audit"

export function getServerAdminAuditLogs(query: AdminAuditLogsQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const suffix = search.size ? `?${search.toString()}` : ""
  return adminAuditServerFetch<AdminAuditLogsPage>(`/admin/audit-logs${suffix}`)
}

async function adminAuditServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Audit logs require an authenticated admin session.")
  }

  const response = await fetchServerApi(path, { cookie })
  if (!response.ok) {
    throw new Error(`Audit logs request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
