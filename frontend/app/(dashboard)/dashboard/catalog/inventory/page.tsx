import { InventoryManagement } from "./inventory-management"
import { getServerCatalogInventory } from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
  const { activeStore } = await getOperationalStoreContext()
  const [initialPage, connections] = await Promise.all([
    getServerCatalogInventory(activeStore.id),
    getServerChannelConnections(activeStore.id),
  ])

  return (
    <InventoryManagement
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialPage={initialPage}
      connections={connections}
    />
  )
}
