import { getServerStoreKnowledge } from "@/lib/api/knowledge.server"
import { getManagedOperationalStoreContext } from "@/lib/stores/active-store"
import { AiResponseSettings } from "./ai-response-settings"

export const dynamic = "force-dynamic"

export default async function AiSettingsPage() {
  const { activeStore } = await getManagedOperationalStoreContext()
  const knowledge = await getServerStoreKnowledge(activeStore.id)

  return (
    <AiResponseSettings
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialKnowledge={knowledge}
    />
  )
}
