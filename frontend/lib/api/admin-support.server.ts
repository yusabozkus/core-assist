import "server-only"

import { headers } from "next/headers"

import type {
  AdminSupportPerson,
  AdminSupportTicketDetail,
  AdminSupportTicketList,
  AdminSupportTicketQuery,
} from "@/types/admin-support"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class AdminSupportTicketNotFoundError extends Error {
  constructor() {
    super("Admin support ticket was not found.")
    this.name = "AdminSupportTicketNotFoundError"
  }
}

export function getServerAdminSupportTickets(query: AdminSupportTicketQuery) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }

  const suffix = search.size ? `?${search.toString()}` : ""
  return adminSupportServerFetch<AdminSupportTicketList>(
    `/admin/support/tickets${suffix}`
  )
}

export function getServerAdminSupportTicket(ticketId: string) {
  return adminSupportServerFetch<AdminSupportTicketDetail>(
    `/admin/support/tickets/${encodeURIComponent(ticketId)}`,
    { ticketNotFound: true }
  )
}

export function getServerAdminSupportAgents() {
  return adminSupportServerFetch<AdminSupportPerson[]>("/admin/support/agents")
}

async function adminSupportServerFetch<T>(
  path: string,
  options: { ticketNotFound?: boolean } = {}
) {
  const cookie = (await headers()).get("cookie")
  if (!cookie)
    throw new Error("Admin support requires an authenticated session.")

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404 && options.ticketNotFound) {
    throw new AdminSupportTicketNotFoundError()
  }
  if (!response.ok) {
    throw new Error(`Admin support request failed with ${response.status}.`)
  }
  return response.json() as Promise<T>
}
