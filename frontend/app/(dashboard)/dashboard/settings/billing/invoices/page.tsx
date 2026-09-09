import { InvoicesClient } from "./invoices-client"
import { getServerBillingHistory } from "@/lib/api/billing.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export default async function InvoicesPage() {
  const { activeStore } = await getActiveStoreContext()
  if (!activeStore) return null

  const history = await getServerBillingHistory(activeStore.id).catch(
    () => null
  )

  return <InvoicesClient storeId={activeStore.id} history={history} />
}
