import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { BillingPaymentIssueShell } from "@/components/dashboard/billing/billing-payment-issue-banner"
import { BillingUsageProvider } from "@/components/dashboard/billing/billing-usage-provider"
import { SetupGuide } from "@/components/dashboard/setup/setup-guide"
import { DashboardHeader } from "@/components/shared/dashboard/dashboard-header"
import { MobileBottomNavigation } from "@/components/shared/dashboard/mobile-bottom-navigation"
import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { APP_ROUTES } from "@/constants/site"
import {
  getServerBillingWorkspaces,
  getServerStoreBillingUsage,
} from "@/lib/api/billing.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"
import { getDashboardSyncState } from "@/lib/channels/sync-state"
import { canManageStore } from "@/lib/dashboard-access"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export async function DashboardShell({
  children,
  requireActiveStore = true,
}: Readonly<{
  children: React.ReactNode
  requireActiveStore?: boolean
}>) {
  const [currentUser, status] = await Promise.all([
    getCurrentUser(),
    getOnboardingStatus(),
  ])

  if (!currentUser || !status) redirect(APP_ROUTES.login)
  if (!status.completed) redirect(APP_ROUTES.onboarding)

  const { stores, activeStore } = await getActiveStoreContext()
  if (requireActiveStore && !activeStore) redirect(APP_ROUTES.onboarding)

  const mayManageStore = canManageStore(activeStore?.accessLevel)
  const [connections, billingWorkspaces, billingUsage] = await Promise.all([
    activeStore?.status === "ACTIVE" && mayManageStore
      ? getServerChannelConnections(activeStore.id).catch(() => null)
      : [],
    getServerBillingWorkspaces().catch(() => []),
    activeStore
      ? getServerStoreBillingUsage(activeStore.id).catch(() => null)
      : null,
  ])
  const sidebarDefaultOpen =
    (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <BillingUsageProvider
      key={activeStore?.id ?? "account-dashboard"}
      storeId={activeStore?.id ?? null}
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
            activeShopId={activeStore?.id ?? null}
            canManageBilling={billingWorkspaces.length > 0}
          />
          <SidebarInset className="min-h-0">
            <DashboardHeader
              storeId={activeStore?.id}
              syncState={getDashboardSyncState(connections)}
              isStoreArchived={activeStore?.status === "INACTIVE"}
              accessLevel={activeStore?.accessLevel}
            />
            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {children}
            </div>
            {activeStore?.status === "ACTIVE" ? (
              <MobileBottomNavigation accessLevel={activeStore.accessLevel} />
            ) : null}
            {activeStore?.status === "ACTIVE" && mayManageStore ? (
              <SetupGuide
                key={activeStore.id}
                storeId={activeStore.id}
                userId={currentUser.user.id}
                canManageTeam={billingWorkspaces.length > 0}
              />
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
