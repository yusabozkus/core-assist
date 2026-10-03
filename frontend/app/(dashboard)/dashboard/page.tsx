import { DashboardClient } from "./dashboard-client"
import { getServerDashboardOverview } from "@/lib/api/dashboard.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import { parseDashboardRange } from "@/types/dashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const [{ activeStore }, params] = await Promise.all([
    getOperationalStoreContext(),
    searchParams,
  ])
  const range = parseDashboardRange(params.range)
  const initialData = await getServerDashboardOverview(
    activeStore.id,
    range
  ).catch(() => null)

  return (
    <DashboardClient
      key={`${activeStore.id}-${range}`}
      storeId={activeStore.id}
      storeName={activeStore.name}
      accessLevel={activeStore.accessLevel}
      range={range}
      initialData={initialData}
    />
  )
}
