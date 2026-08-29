import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001",
})

export async function signOutCurrentUser() {
  const result = await authClient.signOut()

  if (result.error || !result.data?.success) {
    throw new Error(result.error?.message || "Oturum kapatılamadı.")
  }
}
