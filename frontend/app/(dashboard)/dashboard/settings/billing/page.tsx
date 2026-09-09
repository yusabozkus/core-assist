import { BillingOverview } from "./billing-overview"
import {
  getServerBillingHistory,
  getServerBillingSummary,
} from "@/lib/api/billing.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export default async function BillingPage() {
  const { activeStore } = await getActiveStoreContext()
  if (!activeStore) return null

  const [summary, history] = await Promise.all([
    getServerBillingSummary(activeStore.id),
    getServerBillingHistory(activeStore.id).catch(() => null),
  ])

  return (
    <BillingOverview
      storeId={activeStore.id}
      summary={summary}
      history={history}
    />
  )
}
