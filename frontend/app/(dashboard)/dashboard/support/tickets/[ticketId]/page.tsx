import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { SupportTicketConversation } from "@/components/dashboard/support/support-ticket-conversation"
import { APP_ROUTES } from "@/constants/site"
import { getServerSupportTicket } from "@/lib/api/support.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const metadata: Metadata = {
  title: "Destek talebi | Core Asistan",
}

export const dynamic = "force-dynamic"

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const [{ activeStore }, { ticketId }] = await Promise.all([
    getActiveStoreContext(),
    params,
  ])
  if (!activeStore) redirect(APP_ROUTES.onboarding)
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound()

  const ticket = await getServerSupportTicket(activeStore.id, ticketId).catch(
    () => null
  )
  if (!ticket) notFound()

  return (
    <SupportTicketConversation
      storeId={activeStore.id}
      initialTicket={ticket}
    />
  )
}
