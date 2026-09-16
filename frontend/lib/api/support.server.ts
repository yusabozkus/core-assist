import "server-only"

import { headers } from "next/headers"
import type { SupportTicketDetail, SupportTicketList } from "@/types/support"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

function supportPath(storeId: string) {
  return `/stores/${encodeURIComponent(storeId)}/support/tickets`
}

export function getServerSupportTickets(storeId: string) {
  return supportServerFetch<SupportTicketList>(supportPath(storeId))
}

export function getServerSupportTicket(storeId: string, ticketId: string) {
  return supportServerFetch<SupportTicketDetail>(
    `${supportPath(storeId)}/${encodeURIComponent(ticketId)}`
  )
}

async function supportServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Support requires an authenticated session.")

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Support request failed with status ${response.status}.`)
  }
  return response.json() as Promise<T>
}
