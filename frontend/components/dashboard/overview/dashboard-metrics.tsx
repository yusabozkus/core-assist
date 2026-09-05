import Link from "next/link"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  InboxIcon,
  AlertCircleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"
import type { DashboardOverview } from "@/types/dashboard"
import { dashboardNumber as number, formatDuration } from "./dashboard-format"

export function DashboardMetrics({ data }: { data: DashboardOverview }) {
  const { metrics, queue } = data
  const attention =
    queue.counts.FAILED + queue.counts.REVIEW + queue.counts.UNMATCHED
  const items = [
    {
      label: "Gelen sorular",
      value: metrics.incoming,
      icon: InboxIcon,
      scope: `Son ${data.period.days} gün`,
      detail: comparison(metrics.incoming, metrics.previousIncoming),
      href: APP_ROUTES.dashboard.inbox,
      tone: "text-foreground",
    },
    {
      label: "Yanıtlanan sorular",
      value: metrics.answered,
      icon: CheckmarkCircle01Icon,
      scope: `Son ${data.period.days} gün`,
      detail:
        metrics.averageResponseMinutes === null
          ? "Yanıt süresi henüz ölçülmedi"
          : `Ort. yanıt süresi · ${formatDuration(metrics.averageResponseMinutes)}`,
      href: `${APP_ROUTES.dashboard.inbox}?status=answered`,
      tone: "text-primary",
    },
    {
      label: "Yanıt bekleyen",
      value: queue.total,
      icon: Clock01Icon,
      scope: "Şu anda",
      detail: queue.counts.PROCESSING
        ? `${number.format(queue.counts.PROCESSING)} soru işleniyor veya kuyrukta`
        : "Henüz yanıtlanmamış tüm sorular",
      href: `${APP_ROUTES.dashboard.inbox}?status=pending`,
      tone: "text-foreground",
    },
    {
      label: "İlginiz gerekiyor",
      value: attention,
      icon: AlertCircleIcon,
      scope: "Şu anda",
      detail: attention
        ? "İnceleme, eşleşme veya işlem hatası"
        : "İnceleme gerektiren soru yok",
      href: `${APP_ROUTES.dashboard.inbox}?status=pending`,
      tone: attention ? "text-amber-600 dark:text-amber-400" : "text-primary",
    },
  ]

  return (
    <section
      aria-label="Mağaza istatistikleri"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group min-w-0 rounded-xl border border-border bg-card p-5 shadow-xs transition-colors outline-none hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {item.label}
            </span>
            <HugeiconsIcon
              icon={item.icon}
              className={`size-4.5 shrink-0 ${item.tone}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={`text-3xl font-semibold tracking-tight tabular-nums ${item.tone}`}
            >
              {number.format(item.value)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {item.scope}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
            <p className="text-[11px] leading-5 text-muted-foreground">
              {item.detail}
            </p>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </div>
        </Link>
      ))}
    </section>
  )
}

function comparison(current: number, previous: number) {
  if (previous === 0)
    return current === 0
      ? "Bu dönemde henüz soru gelmedi"
      : "Önceki dönemde soru yoktu"
  const difference = Math.round(((current - previous) / previous) * 100)
  if (difference === 0) return "Önceki dönemle aynı seviyede"
  return `Önceki döneme göre %${Math.abs(difference)} ${difference > 0 ? "artış" : "azalış"}`
}
