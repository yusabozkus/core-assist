import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import { requireCompletedOnboarding } from "@/lib/require-onboarding.server"
import { getServerBillingWorkspaces } from "@/lib/api/billing.server"
import { billingRoutes } from "@/lib/billing-routes"

// Request-local only. Never infer the billing tenant from an active-store cookie.
export const getBillingWorkspace = cache(async (workspaceId: string) => {
  const session = await getCurrentUser()
  if (!session) {
    redirect(
      `${APP_ROUTES.login}?returnTo=${encodeURIComponent(billingRoutes(workspaceId).overview)}`
    )
  }
  await requireCompletedOnboarding()
  const workspaces = await getServerBillingWorkspaces()
  return workspaces.find((workspace) => workspace.id === workspaceId) ?? null
})
