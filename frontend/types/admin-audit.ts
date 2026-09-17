export type AuditActorType = "USER" | "ADMIN" | "SYSTEM"
export type AuditOrigin = "API" | "WORKER" | "WEBHOOK" | "SCHEDULED" | "SYSTEM"
export type AuditResult = "STARTED" | "SUCCESS" | "FAILURE"

export type AdminAuditLog = {
  id: string
  actorType: AuditActorType
  actorUserId: string | null
  actor: { id: string; name: string; email: string } | null
  origin: AuditOrigin
  action: string
  result: AuditResult
  workspaceId: string | null
  workspace: { id: string; name: string } | null
  storeId: string | null
  store: { id: string; name: string } | null
  targetType: string | null
  targetId: string | null
  requestId: string | null
  ipAddress: string | null
  userAgent: string | null
  errorCode: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type AdminAuditLogsPage = {
  items: AdminAuditLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    total: number
    last24Hours: number
    failuresLast24Hours: number
    adminActionsLast24Hours: number
  }
  actions: string[]
  generatedAt: string
}

export type AdminAuditLogsQuery = {
  q?: string
  actorType?: AuditActorType
  origin?: AuditOrigin
  result?: AuditResult
  action?: string
  period?: "24H" | "7D" | "30D"
  order?: "NEWEST" | "OLDEST"
  page?: number
  pageSize?: number
}
