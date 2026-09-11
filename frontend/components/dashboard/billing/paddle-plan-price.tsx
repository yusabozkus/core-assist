"use client"

import { usePaddlePricing } from "@/lib/paddle-pricing"
import type { BillingCycle, BillingPlanId } from "@/types/billing"

export function PaddlePlanPrice({
  planId,
  cycle,
  value,
}: {
  planId: BillingPlanId
  cycle: BillingCycle
  value: "monthly" | "total"
}) {
  const pricing = usePaddlePricing()
  const price = pricing.prices?.[planId][cycle]

  if (pricing.loading) {
    return <span aria-label="Güncel fiyat hesaplanıyor">—</span>
  }

  return <>{price?.[value] ?? "—"}</>
}
