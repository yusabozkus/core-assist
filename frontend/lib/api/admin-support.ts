import { apiFetch } from "@/lib/api/client"
import type {
  AdminSupportPerson,
  AdminSupportTicketDetail,
} from "@/types/admin-support"
import type { SupportTicketStatus } from "@/types/support"

function ticketPath(ticketId: string) {
  return `/admin/support/tickets/${encodeURIComponent(ticketId)}`
}

export function getAdminSupportTicket(ticketId: string, signal?: AbortSignal) {
  return apiFetch<AdminSupportTicketDetail>(ticketPath(ticketId), { signal })
}

export function getAdminSupportAgents(signal?: AbortSignal) {
  return apiFetch<AdminSupportPerson[]>("/admin/support/agents", { signal })
}

export function addAdminSupportMessage(
  ticketId: string,
  message: string,
  visibility: "PUBLIC" | "INTERNAL"
) {
  return apiFetch<AdminSupportTicketDetail>(
    `${ticketPath(ticketId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message, visibility }),
    }
  )
}

export function updateAdminSupportStatus(
  ticketId: string,
  status: SupportTicketStatus
) {
  return apiFetch<AdminSupportTicketDetail>(`${ticketPath(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function updateAdminSupportAssignee(
  ticketId: string,
  assigneeUserId: string | null
) {
  return apiFetch<AdminSupportTicketDetail>(
    `${ticketPath(ticketId)}/assignee`,
    {
      method: "PATCH",
      body: JSON.stringify({ assigneeUserId }),
    }
  )
}
