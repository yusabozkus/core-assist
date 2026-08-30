import { redirect } from "next/navigation"

import {
  DashboardHeader,
  type DashboardSyncState,
} from "@/components/shared/dashboard/dashboard-header"
import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import type { ChannelConnection } from "@/types/channel"

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

  const connections = await getServerChannelConnections(activeStore.id).catch(
    () => null
  )
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
      />
      <SidebarInset className="h-[98vh]">
        <DashboardHeader syncState={syncState} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function getDashboardSyncState(
  connections: ChannelConnection[] | null
): DashboardSyncState {
  if (!connections) return "unavailable"
  if (connections.length === 0) return "idle"

  if (connections.some((connection) => connection.processingStartedAt)) {
    return "syncing"
  }

  if (
    connections.some(
      (connection) => connection.status === "ERROR" || connection.failureReason
    )
  ) {
    return "error"
  }

  const connectedConnections = connections.filter(
    (connection) => connection.status === "CONNECTED"
  )

  if (connectedConnections.length === 0) return "idle"

  if (
    connectedConnections.some(
      (connection) =>
        connection.lastInventorySyncAt !== null ||
        connection.lastSyncAt !== null
    )
  ) {
    return "current"
  }

  return "pending"
}
