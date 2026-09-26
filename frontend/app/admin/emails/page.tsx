import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AdminEmailList } from "@/components/admin/emails/admin-email-list"
import {
  EMAIL_DELIVERY_STATUS,
  EMAIL_SEND_STATUS,
} from "@/components/admin/emails/admin-email-presentation"
import {
  AdminEmailNotFoundError,
  getServerAdminEmails,
} from "@/lib/api/admin-emails.server"
import type {
  AdminEmailQuery,
  EmailDeliveryStatus,
  EmailSendStatus,
} from "@/types/admin-email"

export const metadata: Metadata = { title: "E-posta | Core Asistan Admin" }
export const dynamic = "force-dynamic"

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const value = (key: string) => {
    const entry = params[key]
    return Array.isArray(entry) ? entry[0] : entry
  }
  const status = value("status")
  const deliveryStatus = value("deliveryStatus")
  const page = Number(value("page") ?? 1)
  const uuid = (key: string) => {
    const entry = value(key)
    return entry &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        entry
      )
      ? entry
      : undefined
  }
  const date = (key: string) => {
    const entry = value(key)
    return entry &&
      /^\d{4}-\d{2}-\d{2}T/.test(entry) &&
      Number.isFinite(Date.parse(entry))
      ? entry
      : undefined
  }
  const from = date("from")
  const to = date("to")
  const validRange = !from || !to || new Date(from) < new Date(to)
  const query: AdminEmailQuery = {
    q: value("q")?.trim().slice(0, 120) || undefined,
    status:
      status && Object.hasOwn(EMAIL_SEND_STATUS, status)
        ? (status as EmailSendStatus)
        : undefined,
    deliveryStatus:
      deliveryStatus && Object.hasOwn(EMAIL_DELIVERY_STATUS, deliveryStatus)
        ? (deliveryStatus as EmailDeliveryStatus)
        : undefined,
    workspaceId: uuid("workspaceId"),
    storeId: uuid("storeId"),
    announcementId: uuid("announcementId"),
    from: validRange ? from : undefined,
    to: validRange ? to : undefined,
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
    pageSize: 25,
  }
  const data = await getServerAdminEmails(query).catch((error: unknown) => {
    if (error instanceof AdminEmailNotFoundError) notFound()
    throw error
  })
  return (
    <AdminEmailList key={JSON.stringify(query)} data={data} query={query} />
  )
}
