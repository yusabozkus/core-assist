import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminSupportTicketConversation } from "@/components/admin/support/admin-support-ticket-conversation"
import {
  getServerAdminSupportAgents,
  getServerAdminSupportTicket,
} from "@/lib/api/admin-support.server"

export const metadata: Metadata = {
  title: "Destek Talebi | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound()

  const [ticket, agents] = await Promise.all([
    getServerAdminSupportTicket(ticketId).catch(() => null),
    getServerAdminSupportAgents(),
  ])
  if (!ticket) notFound()

  return (
    <AdminSupportTicketConversation initialTicket={ticket} agents={agents} />
  )
}
