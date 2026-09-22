import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SupportTicketConversation } from "@/components/dashboard/support/support-ticket-conversation"
import {
  getServerSupportTicket,
  SupportTicketNotFoundError,
} from "@/lib/api/support.server"

export const metadata: Metadata = {
  title: "Destek talebi | Core Asistan",
}

export const dynamic = "force-dynamic"

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound()

  let ticket
  try {
    ticket = await getServerSupportTicket(ticketId)
  } catch (error) {
    if (error instanceof SupportTicketNotFoundError) notFound()
    throw error
  }

  return <SupportTicketConversation initialTicket={ticket} />
}
