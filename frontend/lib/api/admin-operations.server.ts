import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"

import type {
  AdminOperationQueueDetail,
  AdminOperationsPage,
  AdminOperationsQuery,
} from "@/types/admin-operations"

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

export function getServerAdminOperationQueue(
  queueKey: string,
  page: number,
  pageSize = 25
) {
  const search = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return adminOperationsServerFetch<AdminOperationQueueDetail>(
    `/admin/operations/queues/${encodeURIComponent(queueKey)}?${search.toString()}`
  )
}

async function adminOperationsServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin operations requires an authenticated session.")
  }

  const response = await fetchServerApi(path, { cookie })
  if (!response.ok) {
    throw new Error(`Admin operations request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
