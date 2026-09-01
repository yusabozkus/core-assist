import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"

export const metadata: Metadata = {
  title: "İlk Kurulum | CoreAssist",
  description:
    "CoreAssist mağazanızı oluşturun, ilk satış kanalınızı seçin ve AI yanıt tercihlerinizi belirleyin.",
}

export default async function OnboardingPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(APP_ROUTES.login)
  }

  return <OnboardingFlow user={currentUser.user} />
}
