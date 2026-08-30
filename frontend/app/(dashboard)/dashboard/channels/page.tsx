import { redirect } from "next/navigation"

import { ChannelManagement } from "./channel-management"
import { APP_ROUTES } from "@/constants/site"
import {
  getServerChannelConnections,
  getServerIntegrationProviders,
} from "@/lib/api/channels.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  const { activeStore } = await getActiveStoreContext()

  if (!activeStore) {
    redirect(APP_ROUTES.onboarding)
  }

  const [connections, providers] = await Promise.all([
    getServerChannelConnections(activeStore.id),
    getServerIntegrationProviders(activeStore.id),
  ])

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-10">
      <ChannelManagement
        storeId={activeStore.id}
        storeName={activeStore.name}
        connections={connections}
        providers={providers}
      />
    </div>
  )
}
