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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Satış kanalları
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {activeStore.name} mağazasının pazaryeri bağlantılarını ve ürün
          senkronizasyonlarını yönetin.
        </p>
      </div>

      <ChannelManagement
        storeId={activeStore.id}
        connections={connections}
        providers={providers}
      />
    </div>
  )
}
