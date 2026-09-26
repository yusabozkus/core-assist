import { apiFetch } from "./client"
import type {
  AdminAnnouncement,
  AnnouncementInput,
  AnnouncementPreview,
} from "@/types/admin-announcement"

export function previewAdminAnnouncement(input: AnnouncementInput) {
  return apiFetch<AnnouncementPreview>("/admin/announcements/preview", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
export function publishAdminAnnouncement(id: string) {
  return apiFetch<AdminAnnouncement>(
    `/admin/announcements/${encodeURIComponent(id)}/publish`,
    { method: "POST" }
  )
}
