import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/shared/sidebar/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { getOnboardingStatus } from "@/lib/api/onboarding.server"
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
        <header className="flex h-14 shrink-0 items-center border-b border-border/70 bg-background/90 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-semibold tracking-tight">
              {activeStore.name}
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-background">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
