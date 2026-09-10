import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BillingCheckout } from "@/components/dashboard/billing/billing-checkout"
import { BillingAccessNotice } from "@/components/dashboard/billing/billing-access-notice"
import { getServerBillingSummary } from "@/lib/api/billing.server"
import { getBillingWorkspace } from "@/lib/billing-workspace.server"
import { billingRoutes } from "@/lib/billing-routes"
import { SUBSCRIPTION_PLANS } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import type { BillingCycle } from "@/types/billing"

export const metadata: Metadata = {
  title: "Güvenli Ödeme | CoreAssist",
  description: "CoreAssist aboneliğinizi güvenli biçimde tamamlayın.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string | string[]
    plan?: string | string[]
    cycle?: string | string[]
  }>
}) {
  const params = await searchParams
  const workspaceId = singleValue(params.workspaceId)
  const planId = singleValue(params.plan)
  const cycle = singleValue(params.cycle)
  const plan = SUBSCRIPTION_PLANS.find((candidate) => candidate.id === planId)
  const billingCycle: BillingCycle | null =
    cycle === "monthly" || cycle === "annual" ? cycle : null
  if (!workspaceId) redirect(APP_ROUTES.dashboard.settings.plans)
  const routes = billingRoutes(workspaceId)
  if (!plan || !billingCycle) redirect(routes.plans)

  const currentUser = await getCurrentUser()
  if (!currentUser) {
    const returnTo = `${APP_ROUTES.checkout}?workspaceId=${encodeURIComponent(workspaceId)}&plan=${plan.id}&cycle=${billingCycle}`
    redirect(`${APP_ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`)
  }
  const workspace = await getBillingWorkspace(workspaceId)
  if (!workspace) return <BillingAccessNotice />

  const summary = await getServerBillingSummary(workspace.id)
  if (
    summary.pendingPlanChange ||
    (summary.subscription.managedByPaddle &&
      !["CANCELED", "EXPIRED"].includes(summary.subscription.status))
  ) {
    redirect(routes.plans)
  }
  return (
    <BillingCheckout
      key={`${workspace.id}:${plan.id}:${billingCycle}`}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      customerEmail={currentUser.user.email}
      plan={plan}
      billingCycle={billingCycle}
    />
  )
}

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
