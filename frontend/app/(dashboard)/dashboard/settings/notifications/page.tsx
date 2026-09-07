import { redirect } from "next/navigation"

import { APP_ROUTES } from "@/constants/site"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import { NotificationsClient } from "./notifications-client"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const { activeStore } = await getActiveStoreContext()

  if (!activeStore) redirect(APP_ROUTES.onboarding)

  return (
    <NotificationsClient
      storeId={activeStore.id}
      storeName={activeStore.name}
    />
  )
}
