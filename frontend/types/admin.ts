export type AdminHeaderSummary = {
  available: boolean
  openSupportTickets: number | null
  paymentIssues: number | null
  activeSyncs: number | null
  systemStatus: "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN"
  systemIssues: number | null
  checkedAt: string
}
