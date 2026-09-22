import { apiFetch } from "@/lib/api/client"
import type { AdminContactMessage, ContactMessageStatus } from "@/types/contact"

export function updateAdminContactMessageStatus(
  messageId: string,
  status: ContactMessageStatus
) {
  return apiFetch<AdminContactMessage>(
    `/admin/contact-messages/${encodeURIComponent(messageId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )
}
