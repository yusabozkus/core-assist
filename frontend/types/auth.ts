export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface AuthSession {
  id: string
  userId: string
  expiresAt: string | Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface CurrentUser {
  user: AuthUser
  session?: AuthSession
}
