import { apiFetch } from "@/lib/api/client"
import type { AdminHeaderSummary } from "@/types/admin"

export function getAdminHeaderSummary() {
  return apiFetch<AdminHeaderSummary>("/admin/header-summary")
}
