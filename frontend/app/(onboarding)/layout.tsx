import { redirect } from "next/navigation"

import { APP_ROUTES } from "@/constants/site"
import { getAdminAccess } from "@/lib/admin-access.server"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"

export const dynamic = "force-dynamic"

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getAdminAccess()

  if (access.status === "authorized") {
    redirect(APP_ROUTES.admin.root)
  }

  const status = await getOnboardingStatus()

  if (!status) {
    redirect(APP_ROUTES.login)
  }

  if (status.completed) {
    redirect(APP_ROUTES.dashboard.root)
  }

  return children
}
