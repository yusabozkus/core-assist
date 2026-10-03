import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { APP_ROUTES } from "@/constants/site"
import { getServerStoreBillingUsage } from "@/lib/api/billing.server"
import {
  getAdditionalStoreOnboardingStatus,
  getOnboardingStatus,
} from "@/lib/api/onboarding.server"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import type { OnboardingStatus } from "@/types/onboarding"

export const metadata: Metadata = {
  title: "Yeni Mağaza Kurulumu | Core Asistan",
}

export const dynamic = "force-dynamic"

const newStoreStatus: OnboardingStatus = {
  completed: false,
  completedAt: null,
  stage: "STORE",
  store: null,
  profile: null,
  channelConnections: [],
  catalogSync: null,
}

export default async function NewStorePage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[] }>
}) {
  const [params, currentUser, accountStatus] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getOnboardingStatus(),
  ])
  if (!currentUser || !accountStatus) redirect(APP_ROUTES.login)
  if (!accountStatus.completed) redirect(APP_ROUTES.onboarding)

  const { activeStore } = await getActiveStoreContext()
  if (!activeStore) redirect(APP_ROUTES.dashboard.root)

  const usage = await getServerStoreBillingUsage(activeStore.id).catch(() => null)
  if (usage && !usage.canManageBilling) redirect(APP_ROUTES.dashboard.root)

  const storeId = Array.isArray(params.storeId)
    ? params.storeId[0]
    : params.storeId
  const status = storeId
    ? await getAdditionalStoreOnboardingStatus(storeId)
    : newStoreStatus
  if (!status) notFound()
  if (status.completed) redirect(APP_ROUTES.dashboard.root)
  if (!storeId && usage?.capacity && usage.capacity.stores.remaining <= 0) {
    redirect(APP_ROUTES.dashboard.settings.plans)
  }

  return (
    <OnboardingFlow
      key={storeId ?? "new-store"}
      user={currentUser.user}
      initialStatus={status}
      mode="additionalStore"
    />
  )
}
