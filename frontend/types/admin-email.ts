export type EmailSendStatus = "PENDING" | "SENT" | "FAILED" | "REVIEW_REQUIRED"
export type EmailDeliveryStatus =
  | "UNKNOWN"
  | "SENT"
  | "DELAYED"
  | "DELIVERED"
  | "FAILED"
  | "SUPPRESSED"
  | "BOUNCED"
  | "COMPLAINED"

export type AdminEmail = {
  id: string
  recipientEmail: string
  senderEmail: string
  subject: string
  emailType: string | null
  status: EmailSendStatus
  deliveryStatus: EmailDeliveryStatus
  deliveryStatusAt: string | null
  providerMessageId: string | null
  attemptCount: number
  firstAttemptAt: string | null
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  sentAt: string | null
  createdAt: string
  workspace: { id: string; name: string } | null
  store: { id: string; name: string } | null
}

export type AdminEmailDetail = AdminEmail & {
  events: {
    id: string
    type: string
    status: EmailDeliveryStatus
    occurredAt: string
    receivedAt: string
  }[]
  eventCount: number
}

export type AdminEmailQuery = {
  q?: string
  status?: EmailSendStatus
  deliveryStatus?: EmailDeliveryStatus
  workspaceId?: string
  storeId?: string
  announcementId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type AdminEmailList = {
  items: AdminEmail[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    sent: number
    delivered: number
    pending: number
    failed: number
    reviewRequired: number
  }
  health: {
    sendingConfigured: boolean
    trackingConfigured: boolean
    senderEmail: string | null
    overdue: number
    oldestPendingAt: string | null
    lastWebhookAt: string | null
    checkedAt: string
  }
  workspace: { id: string; name: string } | null
}
