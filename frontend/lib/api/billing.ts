import { apiFetch } from "@/lib/api/client"
import type {
  BillingCheckoutResult,
  BillingCycle,
  BillingPlanId,
  BillingSummary,
} from "@/types/billing"

export function getBillingSummary(storeId: string, signal?: AbortSignal) {
  return apiFetch<BillingSummary>(`/stores/${storeId}/billing/summary`, {
    signal,
  })
}

export function createBillingCheckout(
  storeId: string,
  plan: BillingPlanId,
  cycle: BillingCycle
) {
  return apiFetch<BillingCheckoutResult>(
    `/stores/${storeId}/billing/checkout`,
    {
      method: "POST",
      body: JSON.stringify({
        plan: plan.toUpperCase(),
        cycle: cycle.toUpperCase(),
      }),
    }
  )
}
