import "server-only"

import { redirect } from "next/navigation"

import { APP_ROUTES } from "@/constants/site"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"

export async function requireCompletedOnboarding() {
  const status = await getOnboardingStatus()

  if (!status) redirect(APP_ROUTES.login)
  if (!status.completed) redirect(APP_ROUTES.onboarding)
}
