import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"

import type {
  AdminBillingDetail,
  AdminBillingList,
  AdminBillingQuery,
} from "@/types/admin-billing"

export class AdminBillingNotFoundError extends Error {
  constructor() {
    super("Admin billing record was not found.")
    this.name = "AdminBillingNotFoundError"
  }
}

export function getServerAdminBilling(query: AdminBillingQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const suffix = search.size ? `?${search.toString()}` : ""
  return adminBillingServerFetch<AdminBillingList>(`/admin/billing${suffix}`)
}

export function getServerAdminBillingDetail(workspaceId: string) {
  return adminBillingServerFetch<AdminBillingDetail>(
    `/admin/billing/${encodeURIComponent(workspaceId)}`
  )
}

async function adminBillingServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie)
    throw new Error("Admin billing requires an authenticated session.")

  const response = await fetchServerApi(path, { cookie })
  if (response.status === 404) throw new AdminBillingNotFoundError()
  if (!response.ok) {
    throw new Error(`Admin billing request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
