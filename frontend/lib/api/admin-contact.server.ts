import "server-only"

import { headers } from "next/headers"
import type {
  AdminContactMessage,
  AdminContactMessageList,
  AdminContactMessageQuery,
} from "@/types/contact"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class AdminContactMessageNotFoundError extends Error {
  constructor() {
    super("Admin contact message was not found.")
    this.name = "AdminContactMessageNotFoundError"
  }
}

export function getServerAdminContactMessages(query: AdminContactMessageQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const suffix = search.size ? `?${search.toString()}` : ""
  return adminContactServerFetch<AdminContactMessageList>(
    `/admin/contact-messages${suffix}`
  )
}

export function getServerAdminContactMessage(messageId: string) {
  return adminContactServerFetch<AdminContactMessage>(
    `/admin/contact-messages/${encodeURIComponent(messageId)}`,
    true
  )
}

async function adminContactServerFetch<T>(path: string, notFound = false) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Admin contact requires authentication.")

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404 && notFound) {
    throw new AdminContactMessageNotFoundError()
  }
  if (!response.ok) {
    throw new Error(`Admin contact request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
