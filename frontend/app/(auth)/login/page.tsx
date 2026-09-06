import type { Metadata } from "next"
import { cookies } from "next/headers"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Giriş Yap | CoreAssist",
  description: "CoreAssist yönetim panelinize güvenli şekilde giriş yapın.",
}

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string | string[]
    returnTo?: string | string[]
    error?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()])
  // Cookie name matches the backend's lastLoginMethod plugin configuration.
  const savedMethod = cookieStore.get("core-assist.last-login-method")?.value
  const lastUsedProvider =
    savedMethod === "google" || savedMethod === "microsoft"
      ? savedMethod
      : undefined
  const reason = typeof params.reason === "string" ? params.reason : undefined
  const returnTo =
    typeof params.returnTo === "string" ? params.returnTo : undefined
  const error = typeof params.error === "string" ? params.error : undefined

  return (
    <LoginForm
      reason={reason}
      returnTo={returnTo}
      error={error}
      lastUsedProvider={lastUsedProvider}
    />
  )
}
