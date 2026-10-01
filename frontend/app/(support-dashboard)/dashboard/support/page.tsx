import type { Metadata } from "next"

import { SupportCenter } from "@/components/dashboard/support/support-center"
import { getServerSupportTickets } from "@/lib/api/support.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

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

  const initialView = firstValue(params.view) === "tickets" ? "tickets" : "help"
  const initialTickets = await getServerSupportTickets()
  return (
    <SupportCenter
      storeId={activeStore?.id ?? null}
      storeName={activeStore?.name ?? null}
      accessLevel={activeStore?.accessLevel}
      initialView={initialView}
      initialTickets={initialTickets}
    />
  )
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
