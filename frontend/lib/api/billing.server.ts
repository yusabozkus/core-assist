import "server-only"

import { headers } from "next/headers"
import type { BillingHistory, BillingSummary } from "@/types/billing"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export async function getServerBillingSummary(storeId: string) {
  return billingServerFetch<BillingSummary>(storeId, "summary")
}

export async function getServerBillingHistory(storeId: string) {
  return billingServerFetch<BillingHistory>(storeId, "invoices")
}

async function billingServerFetch<T>(storeId: string, resource: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Billing requires an authenticated session.")

  const response = await fetch(
    `${apiUrl}/stores/${storeId}/billing/${resource}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(10_000),
    }
  )

  if (!response.ok) {
    throw new Error(`Billing request failed with status ${response.status}.`)
  }

  return response.json() as Promise<T>
}
