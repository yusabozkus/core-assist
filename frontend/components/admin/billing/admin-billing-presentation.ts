import type { BillingSubscriptionStatus } from "@/types/billing"
import type {
  AdminBillingCheckoutStatus,
  AdminBillingCycle,
  AdminBillingPlan,
  AdminBillingPlanChangeStatus,
  AdminPaddleEnvironment,
} from "@/types/admin-billing"

export const ADMIN_BILLING_PLANS: Array<{
  value: AdminBillingPlan
  label: string
}> = [
  { value: "STARTER", label: "Starter" },
  { value: "GROWTH", label: "Growth" },
  { value: "BUSINESS", label: "Business" },
]

export const ADMIN_BILLING_STATUS: Record<
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

export const ADMIN_CHECKOUT_STATUS: Record<
  AdminBillingCheckoutStatus,
  string
> = {
  CREATING: "Oluşturuluyor",
  OPEN: "Ödeme bekliyor",
  REVIEW_REQUIRED: "İnceleme gerekli",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal edildi",
  FAILED: "Başarısız",
}

export const ADMIN_PLAN_CHANGE_STATUS: Record<
  AdminBillingPlanChangeStatus,
  string
> = {
  PREVIEWED: "Önizlendi",
  PROCESSING: "İşleniyor",
  RETRY_SCHEDULED: "Yeniden denenecek",
  AWAITING_WEBHOOK: "Paddle onayı bekleniyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  REVIEW_REQUIRED: "İnceleme gerekli",
}

export function adminBillingPlanLabel(plan: AdminBillingPlan) {
  return ADMIN_BILLING_PLANS.find((item) => item.value === plan)?.label ?? plan
}

export function adminBillingCycleLabel(cycle: AdminBillingCycle) {
  return cycle === "ANNUAL" ? "Yıllık" : "Aylık"
}

export function adminPaddleEnvironmentLabel(
  environment: AdminPaddleEnvironment
) {
  return environment === "PRODUCTION" ? "Canlı" : "Sandbox"
}

export function formatAdminBillingDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatAdminBillingDay(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatAdminBillingNumber(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value)
}
