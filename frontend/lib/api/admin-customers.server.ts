import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"

import type {
  AdminCustomerDetail,
  AdminCustomerList,
  AdminCustomerQuery,
} from "@/types/admin-customer"

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

  const response = await fetchServerApi(path, { cookie })
  if (response.status === 404) throw new AdminCustomerNotFoundError()
  if (!response.ok) {
    throw new Error(`Admin customers request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
