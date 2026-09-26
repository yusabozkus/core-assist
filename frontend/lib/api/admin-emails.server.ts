import "server-only"
import { headers } from "next/headers"
import type {
  AdminEmail,
  AdminEmailDetail,
  AdminEmailList,
  AdminEmailQuery,
} from "@/types/admin-email"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class AdminEmailNotFoundError extends Error {}

async function fetchEmails<T>(path: string): Promise<T> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Admin email requires authentication.")
  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404) throw new AdminEmailNotFoundError()
  if (!response.ok)
    throw new Error(`Admin email request failed with ${response.status}.`)
  return response.json() as Promise<T>
}

export function getServerAdminEmails(query: AdminEmailQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return fetchEmails<AdminEmailList>(`/admin/emails?${search}`)
}

export function getServerAdminEmail(id: string) {
  return fetchEmails<AdminEmailDetail>(
    `/admin/emails/${encodeURIComponent(id)}`
  )
}

export function getServerCustomerEmails(workspaceId: string) {
  return fetchEmails<AdminEmail[]>(
    `/admin/emails/recent/${encodeURIComponent(workspaceId)}`
  )
}
