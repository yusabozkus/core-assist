import "server-only"

import { headers } from "next/headers"

import type {
  AdminCustomerDetail,
  AdminCustomerList,
  AdminCustomerQuery,
} from "@/types/admin-customer"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class AdminCustomerNotFoundError extends Error {
  constructor() {
    super("Admin customer was not found.")
    this.name = "AdminCustomerNotFoundError"
  }
}

export function getServerAdminCustomers(query: AdminCustomerQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }

  const suffix = search.size ? `?${search.toString()}` : ""
  return adminCustomersServerFetch<AdminCustomerList>(
    `/admin/customers${suffix}`
  )
}

export function getServerAdminCustomer(workspaceId: string) {
  return adminCustomersServerFetch<AdminCustomerDetail>(
    `/admin/customers/${encodeURIComponent(workspaceId)}`
  )
}

async function adminCustomersServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin customers requires an authenticated session.")
  }

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404) throw new AdminCustomerNotFoundError()
  if (!response.ok) {
    throw new Error(`Admin customers request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
