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
