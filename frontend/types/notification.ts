export type NotificationType =
  | "AI_REVIEW_REQUIRED"
  | "AI_DRAFT_FAILED"
  | "ANSWER_DELIVERY_FAILED"
  | "PRODUCT_SYNC_FAILED"
  | "QUESTION_SYNC_FAILED"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "CHANNEL_CONNECTION_ERROR"

export type NotificationSeverity = "INFO" | "WARNING" | "ERROR"
export type NotificationReadFilter = "ALL" | "UNREAD"

export type AppNotification = {
  id: string
  recipientUserId: string
  storeId: string | null
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  occurrenceCount: number
  readAt: string | null
  lastOccurredAt: string
  createdAt: string
  updatedAt: string
  store: {
    id: string
    name: string
  } | null
}

export type NotificationPage = {
  items: AppNotification[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export type NotificationPreference = {
  type: NotificationType
  enabled: boolean
}

export type NotificationPreferences = {
  storeId: string
  preferences: NotificationPreference[]
}

export type NotificationDeliverySettings = {
  storeId: string
  browserEnabled: boolean
  emailEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  timezone: string
  availability: {
    browser: boolean
    email: boolean
    browserSubscribed: boolean
  }
}
