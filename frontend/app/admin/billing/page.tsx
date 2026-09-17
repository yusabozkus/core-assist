import type { Metadata } from "next"

import { AdminBillingListView } from "@/components/admin/billing/admin-billing-list"
import { getServerAdminBilling } from "@/lib/api/admin-billing.server"
import type { AdminBillingPlan, AdminBillingQuery } from "@/types/admin-billing"
import type { BillingSubscriptionStatus } from "@/types/billing"

export const metadata: Metadata = {
  title: "Abonelikler | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const PLANS = new Set<AdminBillingPlan>(["STARTER", "GROWTH", "BUSINESS"])
const STATUSES = new Set<BillingSubscriptionStatus>([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
  "CANCELED",
  "EXPIRED",
])
const ISSUES = new Set<NonNullable<AdminBillingQuery["issue"]>>([
  "PAYMENT",
  "RECONCILIATION",
  "CHECKOUT",
  "PLAN_CHANGE",
])
const SORTS = new Set<NonNullable<AdminBillingQuery["sort"]>>([
  "UPDATED",
  "PERIOD_END",
  "FAILURES",
])

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseQuery(await searchParams)
  const data = await getServerAdminBilling(query)
  return <AdminBillingListView data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminBillingQuery {
  const q = first(params.q)?.trim().slice(0, 120)
  const plan = first(params.plan) as AdminBillingPlan | undefined
  const status = first(params.status) as BillingSubscriptionStatus | undefined
  const issue = first(params.issue) as
    NonNullable<AdminBillingQuery["issue"]> | undefined
  const sort = first(params.sort) as
    NonNullable<AdminBillingQuery["sort"]> | undefined
  const page = Number(first(params.page) ?? "1")

  return {
    q: q || undefined,
    plan: plan && PLANS.has(plan) ? plan : undefined,
    status: status && STATUSES.has(status) ? status : undefined,
    issue: issue && ISSUES.has(issue) ? issue : undefined,
    sort: sort && SORTS.has(sort) ? sort : "UPDATED",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
