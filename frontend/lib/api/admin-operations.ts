import { apiFetch } from "@/lib/api/client"
import type { AdminOperationRetryResult } from "@/types/admin-operations"

export function retryAdminSyncRun(syncRunId: string) {
  return apiFetch<AdminOperationRetryResult>(
    `/admin/operations/sync-runs/${encodeURIComponent(syncRunId)}/retry`,
    { method: "POST" }
  )
}
