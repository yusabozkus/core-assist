import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Giriş Yap | CoreAssist",
  description: "CoreAssist yönetim panelinize güvenli şekilde giriş yapın.",
}

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string | string[]
    returnTo?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const reason = typeof params.reason === "string" ? params.reason : undefined
  const returnTo =
    typeof params.returnTo === "string" ? params.returnTo : undefined

  return <LoginForm reason={reason} returnTo={returnTo} />
}
