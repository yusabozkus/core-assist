import { getServerStoreKnowledge } from "@/lib/api/knowledge.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import { AiResponseSettings } from "./ai-response-settings"

export const dynamic = "force-dynamic"

export default async function AiSettingsPage() {
  const { activeStore } = await getOperationalStoreContext()
  const knowledge = await getServerStoreKnowledge(activeStore.id)

  return (
    <AiResponseSettings
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialKnowledge={knowledge}
    />
  )
}
