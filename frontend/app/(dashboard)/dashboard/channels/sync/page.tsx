import { SyncHistory } from "./sync-history"
import { getServerChannelSyncHistory } from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function SyncHistoryPage() {
  const { activeStore } = await getOperationalStoreContext()
  const initialPage = await getServerChannelSyncHistory(activeStore.id)

  return (
    <SyncHistory
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialPage={initialPage}
    />
  )
}
