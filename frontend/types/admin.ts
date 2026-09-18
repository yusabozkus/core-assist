export type AdminHeaderSummary = {
  openSupportTickets: number
  paymentIssues: number
  activeSyncs: number
  systemStatus: "HEALTHY" | "DEGRADED" | "DOWN"
  systemIssues: number
  checkedAt: string
}
