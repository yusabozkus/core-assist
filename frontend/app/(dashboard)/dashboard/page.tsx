import { DashboardClient } from "./dashboard-client"
import { getCurrentUser } from "@/lib/server-auth"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [currentUser, storeContext] = await Promise.all([
    getCurrentUser(),
    getActiveStoreContext(),
  ])

  return (
    <DashboardClient
      user={currentUser?.user ?? null}
      activeStore={storeContext.activeStore}
    />
  )
}
