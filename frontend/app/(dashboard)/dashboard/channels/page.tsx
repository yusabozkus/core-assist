import { ChannelManagement } from "./channel-management"
import {
  getServerChannelConnections,
  getServerIntegrationProviders,
} from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  const { activeStore } = await getOperationalStoreContext()

  const [connections, providers] = await Promise.all([
    getServerChannelConnections(activeStore.id),
    getServerIntegrationProviders(activeStore.id),
  ])

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ChannelManagement
        storeId={activeStore.id}
        storeName={activeStore.name}
        connections={connections}
        providers={providers}
      />
    </div>
  )
}
