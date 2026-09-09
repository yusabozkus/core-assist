import { formatCurrency } from "@/lib/format-currency"
import { ANNUAL_DISCOUNT_RATE } from "@/constants/billing"
import type {
  BillingCycle,
  InvoiceRecord,
  SubscriptionPlan,
} from "@/types/billing"

export const formatPlanPrice = (amount: number) =>
  formatCurrency(amount, "TRY", { maximumFractionDigits: 0 })

export const formatBillingAmount = (amount: number, currency = "TRY") =>
  formatCurrency(amount, currency, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function formatBillingDate(value: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export function formatBillingPeriod(
  start: string | Date | null,
  end: string | Date | null
) {
  if (!start || !end) return "Tek seferlik ödeme"
  return `${formatBillingDate(start)} – ${formatBillingDate(end)}`
}

export function getBillingPlanName(plan: InvoiceRecord["plan"]) {
  if (!plan) return "CoreAssist aboneliği"
  return plan.charAt(0) + plan.slice(1).toLocaleLowerCase("tr-TR")
}

export function getBillingCycleName(cycle: InvoiceRecord["cycle"]) {
  if (!cycle) return null
  return cycle === "ANNUAL" ? "Yıllık plan" : "Aylık plan"
}

export function getInvoiceDescription(invoice: InvoiceRecord) {
  return [getBillingPlanName(invoice.plan), getBillingCycleName(invoice.cycle)]
    .filter(Boolean)
    .join(" · ")
}

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle) {
  const monthly =
    plan.monthlyPrice *
    (cycle === "annual" ? 1 - ANNUAL_DISCOUNT_RATE : 1)
  return {
    monthly: formatPlanPrice(monthly),
    total: formatPlanPrice(cycle === "annual" ? monthly * 12 : monthly),
    saving: formatPlanPrice(plan.monthlyPrice * 12 * ANNUAL_DISCOUNT_RATE),
  }
}
