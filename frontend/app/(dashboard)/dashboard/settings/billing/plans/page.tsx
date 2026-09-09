import { PlansClient } from "./plans-client"
import { getServerBillingSummary } from "@/lib/api/billing.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export default async function PlansPage() {
  const { activeStore } = await getActiveStoreContext()
  if (!activeStore) return null

  const billing = await getServerBillingSummary(activeStore.id).catch(
    () => null
  )

  return <PlansClient initialBillingSummary={billing} />
}
