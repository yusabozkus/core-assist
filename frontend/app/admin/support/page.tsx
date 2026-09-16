import type { Metadata } from "next"

import { AdminSupportTicketList } from "@/components/admin/support/admin-support-ticket-list"
import { getServerAdminSupportTickets } from "@/lib/api/admin-support.server"
import type { AdminSupportTicketQuery } from "@/types/admin-support"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support"

export const metadata: Metadata = {
  title: "Destek Talepleri | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const STATUSES = new Set<SupportTicketStatus>([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
])
const PRIORITIES = new Set<SupportTicketPriority>(["NORMAL", "HIGH", "URGENT"])
const CATEGORIES = new Set<SupportTicketCategory>([
  "CHANNELS",
  "AI_AUTOMATION",
  "CATALOG_INVENTORY",
  "BILLING_ACCOUNT",
  "TEAM_ACCESS",
  "OTHER",
])
const ASSIGNEES = new Set<NonNullable<AdminSupportTicketQuery["assignee"]>>([
  "ME",
  "UNASSIGNED",
])
const SORTS = new Set<NonNullable<AdminSupportTicketQuery["sort"]>>([
  "LAST_ACTIVITY",
  "OLDEST",
  "SLA",
])

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const data = await getServerAdminSupportTickets(query)
  const queryKey = JSON.stringify(query)

  return <AdminSupportTicketList key={queryKey} data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminSupportTicketQuery {
  const q = firstValue(params.q)?.trim().slice(0, 120)
  const status = firstValue(params.status) as SupportTicketStatus | undefined
  const priority = firstValue(params.priority) as
    SupportTicketPriority | undefined
  const category = firstValue(params.category) as
    SupportTicketCategory | undefined
  const assignee = firstValue(params.assignee) as
    NonNullable<AdminSupportTicketQuery["assignee"]> | undefined
  const sort = firstValue(params.sort) as
    NonNullable<AdminSupportTicketQuery["sort"]> | undefined
  const rawPage = Number(firstValue(params.page) ?? 1)

  return {
    ...(q ? { q } : {}),
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(priority && PRIORITIES.has(priority) ? { priority } : {}),
    ...(category && CATEGORIES.has(category) ? { category } : {}),
    ...(assignee && ASSIGNEES.has(assignee) ? { assignee } : {}),
    sort: sort && SORTS.has(sort) ? sort : "LAST_ACTIVITY",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: 25,
  }
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
