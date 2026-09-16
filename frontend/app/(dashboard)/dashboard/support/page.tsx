import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SupportCenter } from "@/components/dashboard/support/support-center"
import { APP_ROUTES } from "@/constants/site"
import { getServerSupportTickets } from "@/lib/api/support.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import type { SupportTicketList } from "@/types/support"

export const metadata: Metadata = {
  title: "Yardım Merkezi | Core Asistan",
  description:
    "Core Asistan kullanımıyla ilgili yanıtları bulun ve destek ekibine ulaşın.",
}

export const dynamic = "force-dynamic"

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ activeStore }, params] = await Promise.all([
    getActiveStoreContext(),
    searchParams,
  ])
  if (!activeStore) redirect(APP_ROUTES.onboarding)

  const initialView = firstValue(params.view) === "tickets" ? "tickets" : "help"
  const initialTickets = await getServerSupportTickets(activeStore.id).catch(
    (): SupportTicketList => ({
      items: [],
      total: 0,
      counts: {
        OPEN: 0,
        IN_PROGRESS: 0,
        WAITING_CUSTOMER: 0,
        RESOLVED: 0,
        CLOSED: 0,
      },
    })
  )
  return (
    <SupportCenter
      storeId={activeStore.id}
      storeName={activeStore.name}
      initialView={initialView}
      initialTickets={initialTickets}
    />
  )
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
