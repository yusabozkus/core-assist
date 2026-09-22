import type { AdminHeaderSummary } from "@/types/admin"

export function unavailableAdminHeaderSummary(): AdminHeaderSummary {
  return {
    available: false,
    openSupportTickets: null,
    paymentIssues: null,
    activeSyncs: null,
    systemStatus: "UNKNOWN",
    systemIssues: null,
    checkedAt: new Date().toISOString(),
  }
}
