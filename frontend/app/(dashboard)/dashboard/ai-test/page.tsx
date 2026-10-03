import { notFound } from "next/navigation"

import { getServerCatalogProducts } from "@/lib/api/catalog.server"
import { getManagedOperationalStoreContext } from "@/lib/stores/active-store"

import { AiTestClient } from "./ai-test-client"

export const dynamic = "force-dynamic"

export default async function AiTestPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_AI_TEST_ENABLED !== "true"
  ) {
    notFound()
  }

  const { activeStore } = await getManagedOperationalStoreContext()
  const initialPage = await getServerCatalogProducts(activeStore.id)

  return (
    <AiTestClient
      key={activeStore.id}
      storeId={activeStore.id}
      initialPage={initialPage}
    />
  )
}
