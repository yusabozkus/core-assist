import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BillingCheckout } from "@/components/dashboard/billing/billing-checkout"
import { SUBSCRIPTION_PLANS } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import type { BillingCycle } from "@/types/billing"

export const metadata: Metadata = {
  title: "Güvenli Ödeme | CoreAssist",
  description: "CoreAssist aboneliğinizi güvenli biçimde tamamlayın.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

type CheckoutPageProps = {
  searchParams: Promise<{
    plan?: string | string[]
    cycle?: string | string[]
  }>
}

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(
      `${APP_ROUTES.login}?returnTo=${encodeURIComponent(APP_ROUTES.dashboard.settings.plans)}`
    )
  }

  const [params, { activeStore }] = await Promise.all([
    searchParams,
    getActiveStoreContext(),
  ])
  const planId = singleValue(params.plan)
  const cycleValue = singleValue(params.cycle)
  const plan = SUBSCRIPTION_PLANS.find((candidate) => candidate.id === planId)
  const billingCycle = parseBillingCycle(cycleValue)

  if (!activeStore || !plan || !billingCycle) {
    redirect(APP_ROUTES.dashboard.settings.plans)
  }

  return (
    <BillingCheckout
      storeId={activeStore.id}
      customerEmail={currentUser.user.email}
      plan={plan}
      billingCycle={billingCycle}
    />
  )
}

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}

function parseBillingCycle(value: string | undefined): BillingCycle | null {
  return value === "monthly" || value === "annual" ? value : null
}
