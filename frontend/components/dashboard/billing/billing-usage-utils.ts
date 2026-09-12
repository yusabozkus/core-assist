import type { StoreBillingUsageOverview } from "@/types/billing"

export const billingPlanLabels = {
  STARTER: "Starter",
  GROWTH: "Growth",
  BUSINESS: "Business",
} as const

export function getUsageLevel(percentage: number) {
  if (percentage >= 100) return "exhausted"
  if (percentage >= 90) return "critical"
  if (percentage >= 80) return "warning"
  return "normal"
}

export function getUsageBarClass(percentage: number) {
  switch (getUsageLevel(percentage)) {
    case "exhausted":
      return "bg-destructive"
    case "critical":
      return "bg-orange-500 dark:bg-orange-400"
    case "warning":
      return "bg-amber-500 dark:bg-amber-400"
    default:
      return "bg-primary"
  }
}

export function getUsageTextClass(percentage: number) {
  switch (getUsageLevel(percentage)) {
    case "exhausted":
      return "text-destructive"
    case "critical":
      return "text-orange-600 dark:text-orange-400"
    case "warning":
      return "text-amber-600 dark:text-amber-400"
    default:
      return "text-primary"
  }
}

export function formatUsagePeriod(usage: StoreBillingUsageOverview) {
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
  }).format(new Date(usage.periodEnd))

  if (usage.status === "EXPIRED" || usage.status === "CANCELED") {
    return "Abonelik sona erdi"
  }
  if (usage.status === "PAUSED") return "Abonelik duraklatıldı"
  if (usage.status === "PAST_DUE") return "Ödeme işlemi bekleniyor"
  if (usage.cancelAtPeriodEnd) return `${date} tarihinde sona erer`
  if (usage.status === "TRIALING") return `Deneme ${date} tarihinde sona erer`
  return `${date} tarihinde yenilenir`
}
