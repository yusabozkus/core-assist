import type { Metadata } from "next"

import { AdminOperationsListView } from "@/components/admin/operations/admin-operations-list"
import { getServerAdminOperations } from "@/lib/api/admin-operations.server"
import type { AdminOperationsQuery } from "@/types/admin-operations"
import type { IntegrationEnvironment } from "@/types/channel"
import type { SyncHistoryKind, SyncHistoryStatus } from "@/types/sync-history"

export const metadata: Metadata = {
  title: "Operasyonlar | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const STATUSES = new Set<SyncHistoryStatus>(["RUNNING", "COMPLETED", "FAILED"])
const KINDS = new Set<SyncHistoryKind>(["FULL", "INVENTORY", "QUESTION"])
const ENVIRONMENTS = new Set<IntegrationEnvironment>(["SANDBOX", "PRODUCTION"])
const ISSUES = new Set<NonNullable<AdminOperationsQuery["issue"]>>([
  "STALE",
  "CONNECTION",
])
const PERIODS = new Set<NonNullable<AdminOperationsQuery["period"]>>([
  "24H",
  "7D",
  "30D",
])
const ORDERS = new Set<NonNullable<AdminOperationsQuery["order"]>>([
  "NEWEST",
  "OLDEST",
])

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseQuery(await searchParams)
  const data = await getServerAdminOperations(query)
  return <AdminOperationsListView data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminOperationsQuery {
  const q = first(params.q)?.trim().slice(0, 120)
  const status = first(params.status) as SyncHistoryStatus | undefined
  const kind = first(params.kind) as SyncHistoryKind | undefined
  const provider = first(params.provider)?.trim().slice(0, 50)
  const environment = first(params.environment) as
    IntegrationEnvironment | undefined
  const issue = first(params.issue) as
    NonNullable<AdminOperationsQuery["issue"]> | undefined
  const period = first(params.period) as
    NonNullable<AdminOperationsQuery["period"]> | undefined
  const order = first(params.order) as
    NonNullable<AdminOperationsQuery["order"]> | undefined
  const page = Number(first(params.page) ?? "1")

  return {
    q: q || undefined,
    status: status && STATUSES.has(status) ? status : undefined,
    kind: kind && KINDS.has(kind) ? kind : undefined,
    provider: provider || undefined,
    environment:
      environment && ENVIRONMENTS.has(environment) ? environment : undefined,
    issue: issue && ISSUES.has(issue) ? issue : undefined,
    period: period && PERIODS.has(period) ? period : undefined,
    order: order && ORDERS.has(order) ? order : "NEWEST",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
