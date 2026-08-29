import { redirect } from "next/navigation"

import { APP_ROUTES } from "@/constants/site"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"

export const dynamic = "force-dynamic"

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const status = await getOnboardingStatus()

  if (!status) {
    redirect(APP_ROUTES.login)
  }

  if (status.completed) {
    redirect(APP_ROUTES.dashboard.root)
  }

  return children
}
