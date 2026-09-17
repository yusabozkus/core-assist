import "server-only"

import { headers } from "next/headers"

import type {
  AdminBillingDetail,
  AdminBillingList,
  AdminBillingQuery,
} from "@/types/admin-billing"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

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

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404) throw new AdminBillingNotFoundError()
  if (!response.ok) {
    throw new Error(`Admin billing request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
