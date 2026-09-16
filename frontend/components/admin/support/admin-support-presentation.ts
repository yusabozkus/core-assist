import type {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support"

export const ADMIN_SUPPORT_STATUS: Record<
  SupportTicketStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: "Açık",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  IN_PROGRESS: {
    label: "İnceleniyor",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  WAITING_CUSTOMER: {
    label: "Kullanıcı bekleniyor",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  RESOLVED: {
    label: "Çözüldü",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  CLOSED: {
    label: "Kapalı",
    className: "border-border bg-muted text-muted-foreground",
  },
}

export const ADMIN_SUPPORT_PRIORITY: Record<
  SupportTicketPriority,
  { label: string; className: string }
> = {
  NORMAL: {
    label: "Normal",
    className: "text-muted-foreground",
  },
  HIGH: {
    label: "Yüksek",
    className: "text-amber-700 dark:text-amber-400",
  },
  URGENT: {
    label: "Acil",
    className: "text-destructive",
  },
}

export const ADMIN_SUPPORT_STATUS_OPTIONS = [
  { value: "OPEN", label: "Açık" },
  { value: "IN_PROGRESS", label: "İnceleniyor" },
  { value: "WAITING_CUSTOMER", label: "Kullanıcı bekleniyor" },
  { value: "RESOLVED", label: "Çözüldü" },
  { value: "CLOSED", label: "Kapalı" },
] as const

export const ADMIN_SUPPORT_PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Yüksek" },
  { value: "URGENT", label: "Acil" },
] as const

export function formatAdminSupportDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatAdminSupportRelativeDate(
  value: string,
  referenceTime: number
) {
  const date = new Date(value)
  const now = new Date(referenceTime)
  const differenceMinutes = Math.floor((referenceTime - date.getTime()) / 60000)

  if (differenceMinutes < 1) return "Şimdi"
  if (differenceMinutes < 60) return `${differenceMinutes} dk önce`
  const differenceHours = Math.floor(differenceMinutes / 60)
  if (differenceHours < 24) return `${differenceHours} sa önce`

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date)
}
