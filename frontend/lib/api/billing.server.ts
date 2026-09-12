import "server-only"

import { headers } from "next/headers"
import { cache } from "react"
import type {
  BillingWorkspace,
  BillingHistory,
  BillingSummary,
  StoreBillingUsageOverview,
} from "@/types/billing"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export async function getServerBillingSummary(workspaceId: string) {
  return billingServerFetch<BillingSummary>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/summary`
  )
}

export async function getServerBillingHistory(workspaceId: string) {
  return billingServerFetch<BillingHistory>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/invoices`
  )
}

// Request-scoped deduplication only; permissions are never cached across users.
export const getServerBillingWorkspaces = cache(() =>
  billingServerFetch<BillingWorkspace[]>("/billing/workspaces")
)

export const getServerStoreBillingUsage = cache((storeId: string) =>
  billingServerFetch<StoreBillingUsageOverview>(
    `/stores/${encodeURIComponent(storeId)}/billing/usage`
  )
)

async function billingServerFetch<T>(path: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Billing requires an authenticated session.")

  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Billing request failed with status ${response.status}.`)
  }

  return response.json() as Promise<T>
}
