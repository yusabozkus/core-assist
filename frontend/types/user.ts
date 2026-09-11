export type UserProfile = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateProfilePayload = {
  name: string
}

export type AuthAccountSummary = {
  id: string
  providerId: string
  createdAt: string
}

export type AccountSessionSummary = {
  id: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
  isCurrent: boolean
}

export type AccountOverview = {
  createdAt: string
  ownedStoreCount: number
  accounts: AuthAccountSummary[]
  sessions: AccountSessionSummary[]
}

export type AccountDataExport = {
  schemaVersion: number
  exportedAt: string
  notice: string
  user: Record<string, unknown>
}

export type AccountDeletionStatus = {
  checkedAt: string
  canDelete: boolean
  canResolveBilling: boolean
  workspaces: {
    id: string
    name: string
    issues: string[]
    pendingPaymentCount: number
    subscriptions: {
      id: string
      status: string
      cancelScheduled: boolean
      accessEndsAt: string | null
    }[]
  }[]
}
