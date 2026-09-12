import { apiFetch } from "@/lib/api/client"
import type {
  BillingCheckoutResult,
  BillingCheckoutCancellation,
  BillingWorkspace,
  BillingCycle,
  BillingHistory,
  BillingPlanId,
  BillingPortalSession,
  BillingSummary,
  BillingPlanChangePreview,
  BillingPlanChangeResult,
  BillingPricingConfig,
  StoreBillingUsageOverview,
} from "@/types/billing"

export function getBillingPricingConfig(signal?: AbortSignal) {
  return apiFetch<BillingPricingConfig>("/billing/pricing", { signal })
}

export function getBillingSummary(workspaceId: string, signal?: AbortSignal) {
  return apiFetch<BillingSummary>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/summary`,
    {
      signal,
    }
  )
}

export function getStoreBillingUsage(storeId: string, signal?: AbortSignal) {
  return apiFetch<StoreBillingUsageOverview>(
    `/stores/${encodeURIComponent(storeId)}/billing/usage`,
    { signal }
  )
}

export function createBillingCheckout(
  workspaceId: string,
  plan: BillingPlanId,
  cycle: BillingCycle,
  signal?: AbortSignal
) {
  return apiFetch<BillingCheckoutResult>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/checkout`,
    {
      method: "POST",
      signal,
      body: JSON.stringify({
        plan: plan.toUpperCase(),
        cycle: cycle.toUpperCase(),
      }),
    }
  )
}

export function cancelPendingBillingCheckout(workspaceId: string) {
  return apiFetch<BillingCheckoutCancellation>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/checkout/cancel`,
    { method: "POST" }
  )
}

export function getBillingHistory(workspaceId: string, signal?: AbortSignal) {
  return apiFetch<BillingHistory>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/invoices`,
    {
      signal,
    }
  )
}

export function getBillingInvoicePdf(
  workspaceId: string,
  transactionId: string
) {
  return apiFetch<{ url: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/invoices/${transactionId}/pdf`
  )
}

export function createBillingPortalSession(workspaceId: string) {
  return apiFetch<BillingPortalSession>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/portal-session`,
    { method: "POST" }
  )
}

export function refreshBillingSubscription(
  workspaceId: string,
  signal?: AbortSignal
) {
  return apiFetch<{
    refreshed: boolean
    subscription: Pick<
      BillingSummary["subscription"],
      | "status"
      | "cancelAtPeriodEnd"
      | "scheduledAccessEndsAt"
      | "currentPeriodEnd"
    >
  }>(`/workspaces/${encodeURIComponent(workspaceId)}/billing/refresh`, {
    method: "POST",
    signal,
  })
}

export function previewBillingPlanChange(
  workspaceId: string,
  plan: BillingPlanId,
  cycle: BillingCycle,
  signal?: AbortSignal
) {
  return apiFetch<BillingPlanChangePreview>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/plan-changes/preview`,
    {
      method: "POST",
      signal,
      body: JSON.stringify({
        plan: plan.toUpperCase(),
        cycle: cycle.toUpperCase(),
      }),
    }
  )
}

export function confirmBillingPlanChange(
  workspaceId: string,
  changeId: string
) {
  return apiFetch<BillingPlanChangeResult>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/plan-changes/${changeId}/confirm`,
    { method: "POST" }
  )
}

export function getBillingPlanChange(
  workspaceId: string,
  changeId: string,
  signal?: AbortSignal
) {
  return apiFetch<BillingPlanChangeResult>(
    `/workspaces/${encodeURIComponent(workspaceId)}/billing/plan-changes/${changeId}`,
    { signal }
  )
}

export function prepareBillingWorkspace(signal?: AbortSignal) {
  return apiFetch<BillingWorkspace>("/billing/workspaces", {
    method: "POST",
    signal,
  })
}
