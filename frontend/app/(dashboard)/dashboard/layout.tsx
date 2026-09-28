import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { DashboardHeader } from "@/components/shared/dashboard/dashboard-header"
import { MobileBottomNavigation } from "@/components/shared/dashboard/mobile-bottom-navigation"
import { BillingPaymentIssueShell } from "@/components/dashboard/billing/billing-payment-issue-banner"
import { BillingUsageProvider } from "@/components/dashboard/billing/billing-usage-provider"
import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import {
  getServerBillingWorkspaces,
  getServerStoreBillingUsage,
} from "@/lib/api/billing.server"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"
import { getDashboardSyncState } from "@/lib/channels/sync-state"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import { Toaster } from "@/components/ui/sonner"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [currentUser, status] = await Promise.all([
    getCurrentUser(),
    getOnboardingStatus(),
  ])

  if (!currentUser || !status) {
    redirect(APP_ROUTES.login)
  }

  if (!status.completed) {
    redirect(APP_ROUTES.onboarding)
  }

  const { stores, activeStore } = await getActiveStoreContext()

  if (!activeStore) {
    redirect(APP_ROUTES.onboarding)
  }

  const [connections, billingWorkspaces, billingUsage] = await Promise.all([
    activeStore.status === "ACTIVE"
      ? getServerChannelConnections(activeStore.id).catch(() => null)
      : [],
    getServerBillingWorkspaces().catch(() => []),
    getServerStoreBillingUsage(activeStore.id).catch(() => null),
  ])
  const syncState = getDashboardSyncState(connections)
  const sidebarDefaultOpen =
    (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <BillingUsageProvider
      key={activeStore.id}
      storeId={activeStore.id}
      initialUsage={billingUsage}
    >
      <BillingPaymentIssueShell workspaceId={billingWorkspaces[0]?.id}>
        <SidebarProvider
          defaultOpen={sidebarDefaultOpen}
          className="min-h-0 flex-1"
        >
          <AppSidebar
            variant="inset"
            user={{
              name: currentUser.user.name,
              email: currentUser.user.email,
              avatarUrl: currentUser.user.image,
            }}
            shops={stores}
            activeShopId={activeStore.id}
            canManageBilling={billingWorkspaces.length > 0}
          />
          <SidebarInset className="min-h-0">
            <DashboardHeader
              storeId={activeStore.id}
              syncState={syncState}
              isStoreArchived={activeStore.status === "INACTIVE"}
            />
            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {children}
            </div>
            {activeStore.status === "ACTIVE" ? (
              <MobileBottomNavigation />
            ) : null}
            <Toaster
              position="top-center"
              duration={3000}
              visibleToasts={3}
              gap={10}
              offset={16}
            />
          </SidebarInset>
        </SidebarProvider>
      </BillingPaymentIssueShell>
    </BillingUsageProvider>
  )
}
