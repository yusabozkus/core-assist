import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = {
  title: "Kayıt Ol | CoreAssist",
  description: "CoreAssist hesabı oluşturun.",
}

export default function RegisterPage() {
  return <RegisterForm />
}
