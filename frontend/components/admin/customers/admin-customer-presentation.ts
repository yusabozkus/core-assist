import type { BillingSubscriptionStatus } from "@/types/billing"

export const ADMIN_CUSTOMER_PLANS = [
  { value: "STARTER", label: "Starter" },
  { value: "GROWTH", label: "Growth" },
  { value: "BUSINESS", label: "Business" },
] as const

export const ADMIN_CUSTOMER_SUBSCRIPTION_STATUS: Record<
  BillingSubscriptionStatus,
  { label: string; className: string }
> = {
  TRIALING: {
    label: "Deneme",
    className: "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
  },
  ACTIVE: {
    label: "Aktif",
    className:
      "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
  },
  PAST_DUE: {
    label: "Ödeme gecikmiş",
    className: "border-destructive/25 bg-destructive/8 text-destructive",
  },
  PAUSED: {
    label: "Duraklatıldı",
    className:
      "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
  },
  CANCELED: {
    label: "İptal edildi",
    className: "border-border bg-muted text-muted-foreground",
  },
  EXPIRED: {
    label: "Süresi doldu",
    className: "border-border bg-muted text-muted-foreground",
  },
}

export const ADMIN_CUSTOMER_SUBSCRIPTION_OPTIONS = [
  ...Object.entries(ADMIN_CUSTOMER_SUBSCRIPTION_STATUS).map(
    ([value, item]) => ({ value, label: item.label })
  ),
  { value: "NONE", label: "Abonelik yok" },
] as const

export function adminPlanLabel(plan: string | null | undefined) {
  if (!plan) return "Plansız"
  return ADMIN_CUSTOMER_PLANS.find((item) => item.value === plan)?.label ?? plan
}

export function formatAdminCustomerDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatAdminCustomerDay(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatAdminCustomerRelativeDate(
  value: string | null | undefined,
  referenceTime: number
) {
  if (!value) return "Hiç giriş yapmadı"
  const difference = new Date(value).getTime() - referenceTime
  const minutes = Math.round(difference / 60_000)
  const formatter = new Intl.RelativeTimeFormat("tr", { numeric: "auto" })

  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(days, "day")
  return formatAdminCustomerDay(value)
}

export function providerLabel(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  if (providerKey === "google") return "Google"
  if (providerKey === "microsoft") return "Microsoft"
  return providerKey
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact" }).format(value)
}
