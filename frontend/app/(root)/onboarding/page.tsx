import type { Metadata } from "next"
import { OnboardingClient } from "./onboarding-client"
import { getCurrentUser } from "@/lib/auth/server-auth"

export const metadata: Metadata = {
  title: "İlk Kurulum | CoreAssist",
  description: "CoreAssist çalışma alanınızı ve ilk mağazanızı oluşturun.",
}

export default async function OnboardingPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  return <OnboardingClient user={currentUser.user} />
}
