import { DashboardClient } from "./dashboard-client"
import { getCurrentUser } from "@/lib/server-auth"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [currentUser, storeContext] = await Promise.all([
    getCurrentUser(),
    getOperationalStoreContext(),
  ])

  return (
    <DashboardClient
      user={currentUser?.user ?? null}
      activeStore={storeContext.activeStore}
    />
  )
}
