import { apiFetch } from "@/lib/api/client"
import type { AdminBillingDetail } from "@/types/admin-billing"

export function reconcileAdminBilling(workspaceId: string) {
  return apiFetch<AdminBillingDetail>(
    `/admin/billing/${encodeURIComponent(workspaceId)}/reconcile`,
    { method: "POST" }
  )
}
