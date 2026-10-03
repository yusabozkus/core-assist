import { apiFetch } from "@/lib/api/client"
import type {
  CreateSupportTicketInput,
  SupportTicketDetail,
  SupportTicketList,
} from "@/types/support"

const supportPath = "/support/tickets"

export function getSupportTickets(signal?: AbortSignal) {
  return apiFetch<SupportTicketList>(supportPath, { signal })
}

export function getSupportTicket(
  ticketId: string,
  signal?: AbortSignal
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath}/${encodeURIComponent(ticketId)}`,
    { signal }
  )
}

export function createSupportTicket(input: CreateSupportTicketInput) {
  return apiFetch<SupportTicketDetail>(supportPath, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function replyToSupportTicket(
  ticketId: string,
  message: string
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath}/${encodeURIComponent(ticketId)}/messages`,
    { method: "POST", body: JSON.stringify({ message }) }
  )
}

export function replyWithSupportImages(ticketId: string, message: string, images: File[]) {
  const body = new FormData()
  if (message) body.append("message", message)
  for (const image of images) body.append("images", image)
  return apiFetch<SupportTicketDetail>(
    `${supportPath}/${encodeURIComponent(ticketId)}/image-messages`,
    { method: "POST", body }
  )
}

export function updateSupportTicketStatus(
  ticketId: string,
  action: "RESOLVE" | "REOPEN"
) {
  return apiFetch<SupportTicketDetail>(
    `${supportPath}/${encodeURIComponent(ticketId)}/status`,
    { method: "PATCH", body: JSON.stringify({ action }) }
  )
}
