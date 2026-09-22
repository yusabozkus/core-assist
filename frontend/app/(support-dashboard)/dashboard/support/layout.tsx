import { redirect } from "next/navigation"

import { BillingPaymentIssueShell } from "@/components/dashboard/billing/billing-payment-issue-banner"
import { BillingUsageProvider } from "@/components/dashboard/billing/billing-usage-provider"
import { DashboardHeader } from "@/components/shared/dashboard/dashboard-header"
import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { APP_ROUTES } from "@/constants/site"
import {
  getServerBillingWorkspaces,
  getServerStoreBillingUsage,
} from "@/lib/api/billing.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getDashboardSyncState } from "@/lib/channels/sync-state"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function SupportLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect(APP_ROUTES.login)

  const { stores, activeStore } = await getActiveStoreContext()
  const [connections, billingWorkspaces, billingUsage] = await Promise.all([
    activeStore?.status === "ACTIVE"
      ? getServerChannelConnections(activeStore.id).catch(() => null)
      : [],
    getServerBillingWorkspaces().catch(() => []),
    activeStore
      ? getServerStoreBillingUsage(activeStore.id).catch(() => null)
      : null,
  ])

  return (
    <BillingUsageProvider
      key={activeStore?.id ?? "account-support"}
      storeId={activeStore?.id ?? null}
      initialUsage={billingUsage}
    >
      <BillingPaymentIssueShell workspaceId={billingWorkspaces[0]?.id}>
        <SidebarProvider className="min-h-0 flex-1">
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
            />
            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {children}
            </div>
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
