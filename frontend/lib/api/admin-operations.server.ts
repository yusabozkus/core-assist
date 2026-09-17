import "server-only"

import { headers } from "next/headers"

import type {
  AdminOperationsPage,
  AdminOperationsQuery,
} from "@/types/admin-operations"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export function getServerAdminOperations(query: AdminOperationsQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const suffix = search.size ? `?${search.toString()}` : ""
  return adminOperationsServerFetch<AdminOperationsPage>(
    `/admin/operations${suffix}`
  )
}

async function adminOperationsServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin operations requires an authenticated session.")
  }

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Admin operations request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
