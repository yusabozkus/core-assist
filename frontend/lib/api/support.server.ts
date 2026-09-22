import "server-only"

import { headers } from "next/headers"
import type { SupportTicketDetail, SupportTicketList } from "@/types/support"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

const supportPath = "/support/tickets"

export class SupportTicketNotFoundError extends Error {
  constructor() {
    super("Support ticket was not found.")
    this.name = "SupportTicketNotFoundError"
  }
}

export function getServerSupportTickets() {
  return supportServerFetch<SupportTicketList>(supportPath)
}

export function getServerSupportTicket(ticketId: string) {
  return supportServerFetch<SupportTicketDetail>(
    `${supportPath}/${encodeURIComponent(ticketId)}`,
    { ticketNotFound: true }
  )
}

async function supportServerFetch<T>(
  path: string,
  options: { ticketNotFound?: boolean } = {}
) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Support requires an authenticated session.")

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404 && options.ticketNotFound) {
    throw new SupportTicketNotFoundError()
  }
  if (!response.ok) {
    throw new Error(`Support request failed with status ${response.status}.`)
  }
  return response.json() as Promise<T>
}
