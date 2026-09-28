import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { APP_ROUTES } from "@/constants/site"
import {
  getAdminAccess,
  getAdminHeaderSummaryOrUnavailable,
} from "@/lib/admin-access.server"
import { requireCompletedOnboarding } from "@/lib/require-onboarding.server"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getAdminAccess()

  if (access.status === "unauthenticated") {
    redirect(
      `${APP_ROUTES.login}?returnTo=${encodeURIComponent(APP_ROUTES.admin.root)}`
    )
  }

  await requireCompletedOnboarding()

  if (access.status === "forbidden") {
    redirect(APP_ROUTES.dashboard.root)
  }

  const { user } = access.session
  // Access remains fail-closed above. The header summary is operational
  // decoration and must not make an authorized admin session unusable.
  const headerSummary = await getAdminHeaderSummaryOrUnavailable()
  const sidebarDefaultOpen =
    (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen} className="min-h-svh">
      <AdminSidebar
        variant="inset"
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.image,
        }}
      />
      <SidebarInset className="min-h-0">
        <AdminHeader initialSummary={headerSummary} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          {children}
        </div>
        <Toaster position="top-center" duration={3000} />
      </SidebarInset>
    </SidebarProvider>
  )
}
