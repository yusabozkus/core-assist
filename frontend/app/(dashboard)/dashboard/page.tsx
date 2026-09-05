import { DashboardClient } from "./dashboard-client"
import {
  getServerCatalogInventory,
  getServerCatalogProducts,
} from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getServerProductQuestions } from "@/lib/api/questions.server"
import { getCurrentUser } from "@/lib/server-auth"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [currentUser, storeContext] = await Promise.all([
    getCurrentUser(),
    getOperationalStoreContext(),
  ])
  const storeId = storeContext.activeStore.id
  const [questions, catalog, inventory, channels] = await Promise.all([
    getServerProductQuestions(storeId, { limit: 1 }).catch(() => null),
    getServerCatalogProducts(storeId).catch(() => null),
    getServerCatalogInventory(storeId).catch(() => null),
    getServerChannelConnections(storeId).catch(() => []),
  ])

  return (
    <DashboardClient
      user={currentUser?.user ?? null}
      activeStore={storeContext.activeStore}
      snapshot={{
        questions: {
          total: questions?.summary.total ?? 0,
          pending: questions?.summary.pending ?? 0,
          answered: questions?.summary.answered ?? 0,
        },
        catalog: {
          products: catalog?.summary.products ?? 0,
          variants: catalog?.summary.variants ?? 0,
          totalStock: catalog?.summary.totalStock ?? 0,
        },
        inventory: {
          lowStock: inventory?.summary.lowStock ?? 0,
          outOfStock: inventory?.summary.outOfStock ?? 0,
        },
        channels: {
          connected: channels.filter(
            (channel) => channel.status === "CONNECTED"
          ).length,
          issues: channels.filter((channel) => channel.status === "ERROR")
            .length,
        },
      }}
    />
  )
}
