import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminContactMessageDetail } from "@/components/admin/contact/admin-contact-message-detail"
import {
  AdminContactMessageNotFoundError,
  getServerAdminContactMessage,
} from "@/lib/api/admin-contact.server"

export const metadata: Metadata = {
  title: "İletişim Mesajı | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminContactMessagePage({
  params,
}: {
  params: Promise<{ messageId: string }>
}) {
  const { messageId } = await params
  let message
  try {
    message = await getServerAdminContactMessage(messageId)
  } catch (error) {
    if (error instanceof AdminContactMessageNotFoundError) notFound()
    throw error
  }
  return <AdminContactMessageDetail initialMessage={message} />
}
