import { getServerStoreKnowledge } from "@/lib/api/knowledge.server"
import { getManagedOperationalStoreContext } from "@/lib/stores/active-store"
import { KnowledgeBaseSettings } from "./knowledge-base-settings"

export const dynamic = "force-dynamic"

export default async function KnowledgeBasePage() {
  const { activeStore } = await getManagedOperationalStoreContext()
  const knowledge = await getServerStoreKnowledge(activeStore.id)

  return (
    <KnowledgeBaseSettings
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialKnowledge={knowledge}
    />
  )
}
