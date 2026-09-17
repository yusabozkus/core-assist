import type { Metadata } from "next"

import { AdminAuditLogList } from "@/components/admin/audit/admin-audit-log-list"
import { getServerAdminAuditLogs } from "@/lib/api/admin-audit.server"
import type {
  AdminAuditLogsQuery,
  AuditActorType,
  AuditOrigin,
  AuditResult,
} from "@/types/admin-audit"

export const metadata: Metadata = {
  title: "Denetim kayıtları | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const ACTOR_TYPES = new Set<AuditActorType>(["USER", "ADMIN", "SYSTEM"])
const ORIGINS = new Set<AuditOrigin>([
  "API",
  "WORKER",
  "WEBHOOK",
  "SCHEDULED",
  "SYSTEM",
])
const RESULTS = new Set<AuditResult>(["STARTED", "SUCCESS", "FAILURE"])
const PERIODS = new Set<NonNullable<AdminAuditLogsQuery["period"]>>([
  "24H",
  "7D",
  "30D",
])
const ORDERS = new Set<NonNullable<AdminAuditLogsQuery["order"]>>([
  "NEWEST",
  "OLDEST",
])

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseQuery(await searchParams)
  const data = await getServerAdminAuditLogs(query)
  return <AdminAuditLogList data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminAuditLogsQuery {
  const q = first(params.q)?.trim().slice(0, 120)
  const actorType = first(params.actorType) as AuditActorType | undefined
  const origin = first(params.origin) as AuditOrigin | undefined
  const result = first(params.result) as AuditResult | undefined
  const action = first(params.action)?.trim().slice(0, 160)
  const period = first(params.period) as
    NonNullable<AdminAuditLogsQuery["period"]> | undefined
  const order = first(params.order) as
    NonNullable<AdminAuditLogsQuery["order"]> | undefined
  const page = Number(first(params.page) ?? "1")

  return {
    q: q || undefined,
    actorType: actorType && ACTOR_TYPES.has(actorType) ? actorType : undefined,
    origin: origin && ORIGINS.has(origin) ? origin : undefined,
    result: result && RESULTS.has(result) ? result : undefined,
    action: action || undefined,
    period: period && PERIODS.has(period) ? period : undefined,
    order: order && ORDERS.has(order) ? order : "NEWEST",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
