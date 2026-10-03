import { ProductCatalog } from "./product-catalog"
import { getServerCatalogProducts } from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import { canManageStore } from "@/lib/dashboard-access"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const { activeStore } = await getOperationalStoreContext()
  const [catalogPage, connections] = await Promise.all([
    getServerCatalogProducts(activeStore.id),
    getServerChannelConnections(activeStore.id),
  ])

  return (
    <ProductCatalog
      key={activeStore.id}
      storeId={activeStore.id}
      initialPage={catalogPage}
      connections={connections}
      canManageStore={canManageStore(activeStore.accessLevel)}
    />
  )
}
