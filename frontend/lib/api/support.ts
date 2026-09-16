import { apiFetch } from "@/lib/api/client"
import type {
  CreateSupportTicketInput,
  SupportTicketDetail,
  SupportTicketList,
} from "@/types/support"

function supportPath(storeId: string) {
  return `/stores/${encodeURIComponent(storeId)}/support/tickets`
}

export function getSupportTickets(storeId: string, signal?: AbortSignal) {
  return apiFetch<SupportTicketList>(supportPath(storeId), { signal })
}

export function getSupportTicket(
  storeId: string,
  ticketId: string,
  signal?: AbortSignal
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath(storeId)}/${encodeURIComponent(ticketId)}`,
    { signal }
  )
}

export function createSupportTicket(
  storeId: string,
  input: CreateSupportTicketInput
) {
  return apiFetch<SupportTicketDetail>(supportPath(storeId), {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function replyToSupportTicket(
  storeId: string,
  ticketId: string,
  message: string
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath(storeId)}/${encodeURIComponent(ticketId)}/messages`,
    { method: "POST", body: JSON.stringify({ message }) }
  )
}

export function updateSupportTicketStatus(
  storeId: string,
  ticketId: string,
  action: "RESOLVE" | "REOPEN"
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath(storeId)}/${encodeURIComponent(ticketId)}/status`,
    { method: "PATCH", body: JSON.stringify({ action }) }
  )
}
