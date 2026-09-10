import { redirect } from "next/navigation"

import { DashboardHeader } from "@/components/shared/dashboard/dashboard-header"
import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getServerBillingWorkspaces } from "@/lib/api/billing.server"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"
import { getDashboardSyncState } from "@/lib/channels/sync-state"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"

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

  const [connections, billingWorkspaces] = await Promise.all([
    activeStore.status === "ACTIVE"
      ? getServerChannelConnections(activeStore.id).catch(() => null)
      : [],
    getServerBillingWorkspaces().catch(() => []),
  ])
  const syncState = getDashboardSyncState(connections)

  return (
    <SidebarProvider>
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
      <SidebarInset className="h-[98vh]">
        <DashboardHeader
          storeId={activeStore.id}
          syncState={syncState}
          isStoreArchived={activeStore.status === "INACTIVE"}
        />
        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
