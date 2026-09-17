import type { Metadata } from "next"

import { AdminCustomerListView } from "@/components/admin/customers/admin-customer-list"
import { getServerAdminCustomers } from "@/lib/api/admin-customers.server"
import type {
  AdminCustomerPlan,
  AdminCustomerQuery,
} from "@/types/admin-customer"
import type { BillingSubscriptionStatus } from "@/types/billing"

export const metadata: Metadata = {
  title: "Müşteriler | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const PLANS = new Set<AdminCustomerPlan>(["STARTER", "GROWTH", "BUSINESS"])
const SUBSCRIPTIONS = new Set<BillingSubscriptionStatus | "NONE">([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
  "CANCELED",
  "EXPIRED",
  "NONE",
])
const ONBOARDING = new Set<NonNullable<AdminCustomerQuery["onboarding"]>>([
  "COMPLETED",
  "PENDING",
])
const SORTS = new Set<NonNullable<AdminCustomerQuery["sort"]>>([
  "NEWEST",
  "OLDEST",
  "NAME",
])

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = parseQuery(params)
  const data = await getServerAdminCustomers(query)

  return <AdminCustomerListView data={data} query={query} />
}

function parseQuery(
  params: Record<string, string | string[] | undefined>
): AdminCustomerQuery {
  const q = first(params.q)?.trim().slice(0, 120)
  const plan = first(params.plan) as AdminCustomerPlan | undefined
  const subscription = first(params.subscription) as
    BillingSubscriptionStatus | "NONE" | undefined
  const onboarding = first(params.onboarding) as
    NonNullable<AdminCustomerQuery["onboarding"]> | undefined
  const sort = first(params.sort) as
    NonNullable<AdminCustomerQuery["sort"]> | undefined
  const pageValue = Number(first(params.page) ?? "1")

  return {
    q: q || undefined,
    plan: plan && PLANS.has(plan) ? plan : undefined,
    subscription:
      subscription && SUBSCRIPTIONS.has(subscription)
        ? subscription
        : undefined,
    onboarding:
      onboarding && ONBOARDING.has(onboarding) ? onboarding : undefined,
    sort: sort && SORTS.has(sort) ? sort : "NEWEST",
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
