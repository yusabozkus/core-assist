import type { DashboardQueueState } from "@/types/dashboard"

export const dashboardNumber = new Intl.NumberFormat("tr-TR")

export const queuePresentation: Record<
  DashboardQueueState,
  { label: string; dot: string; text: string }
> = {
  FAILED: {
    label: "İşlem hatası",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  PROCESSING: {
    label: "İşleniyor",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-400",
  },
  UNMATCHED: {
    label: "Ürün eşleşmedi",
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-400",
  },
  REVIEW: {
    label: "İnceleme gerekli",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  READY: {
    label: "Taslak hazır",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  PENDING: {
    label: "Yanıt bekliyor",
    dot: "bg-slate-400",
    text: "text-muted-foreground",
  },
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return "Henüz ölçüm yok"
  if (minutes < 1) return "1 dk'dan kısa"
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} dk`
  if (rounded < 1440) return `${Math.floor(rounded / 60)} sa ${rounded % 60} dk`
  return `${Math.floor(rounded / 1440)} gün ${Math.floor((rounded % 1440) / 60)} sa`
}

export function timeAgo(value: string | null, reference: string) {
  if (!value) return "Henüz yapılmadı"
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(reference) - Date.parse(value)) / 60_000)
  )
  return minutes < 1 ? "Az önce" : `${formatDuration(minutes)} önce`
}

export function dayLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`))
}
