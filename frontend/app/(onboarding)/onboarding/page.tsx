import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"

export const metadata: Metadata = {
  title: "İlk Kurulum | CoreAssist",
  description: "CoreAssist mağazanızı oluşturun ve ilk satış kanalınızı planlayın.",
}

export default async function OnboardingPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(APP_ROUTES.login)
  }

  return <OnboardingFlow user={currentUser.user} />
}
