import { formatCurrency } from "@/lib/format-currency"
import type { BillingCycle, SubscriptionPlan } from "@/types/billing"

export const formatPlanPrice = (amount: number) =>
  formatCurrency(amount, "TRY", { maximumFractionDigits: 0 })

export const formatInvoiceAmount = (amount: number) =>
  formatCurrency(amount, "TRY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle) {
  const monthly = plan.monthlyPrice * (cycle === "annual" ? 0.9 : 1)
  return {
    monthly: formatPlanPrice(monthly),
    total: formatPlanPrice(cycle === "annual" ? monthly * 12 : monthly),
    saving: formatPlanPrice(plan.monthlyPrice * 12 * 0.1),
  }
}
