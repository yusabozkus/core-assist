export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface CurrentUser {
  user: AuthUser
}
