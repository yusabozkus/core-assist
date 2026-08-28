import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Giriş Yap | CoreAssist",
  description: "CoreAssist hesabınıza giriş yapın.",
}

export default function LoginPage() {
  return <LoginForm />
}
