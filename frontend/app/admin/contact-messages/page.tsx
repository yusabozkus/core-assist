import type { Metadata } from "next"

import { AdminContactMessageList } from "@/components/admin/contact/admin-contact-message-list"
import { getServerAdminContactMessages } from "@/lib/api/admin-contact.server"
import type {
  AdminContactMessageQuery,
  ContactMessageStatus,
  ContactMessageTopic,
} from "@/types/contact"

export const metadata: Metadata = {
  title: "İletişim Mesajları | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const STATUSES = new Set<ContactMessageStatus>(["NEW", "READ", "ARCHIVED"])
const TOPICS = new Set<ContactMessageTopic>([
  "PRODUCT",
  "PRICING",
  "PARTNERSHIP",
  "OTHER",
])

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const data = await getServerAdminContactMessages(query)

  return <AdminContactMessageList data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminContactMessageQuery {
  const q = firstValue(params.q)?.trim().slice(0, 120)
  const status = firstValue(params.status) as ContactMessageStatus | undefined
  const topic = firstValue(params.topic) as ContactMessageTopic | undefined
  const rawPage = Number(firstValue(params.page) ?? 1)

  return {
    ...(q ? { q } : {}),
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(topic && TOPICS.has(topic) ? { topic } : {}),
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: 25,
  }
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
