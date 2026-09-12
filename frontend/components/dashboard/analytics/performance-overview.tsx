import Link from "next/link"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import type { AiPerformance } from "@/types/ai-performance"
import {
  automationLabels,
  formatCount,
  formatPercent,
} from "./analytics-format"

type OverviewState = {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  icon: typeof AiSparklesIcon
  tone: string
  iconTone: string
}

function getOverviewState(data: AiPerformance): OverviewState {
  if (data.delivery.failed > 0) {
    return {
      title: "Gönderilemeyen yanıtlar var",
      description: `${formatCount(data.delivery.failed)} yanıt müşteriye ulaştırılamadı. Hata alan gönderimleri gelen kutusundan kontrol edebilirsiniz.`,
      actionLabel: "Gönderimleri kontrol et",
      actionHref: APP_ROUTES.dashboard.inbox,
      icon: AlertCircleIcon,
      tone: "border-red-500/20 bg-red-500/[0.045] dark:bg-red-500/[0.07]",
      iconTone: "bg-red-500/10 text-red-700 dark:text-red-400",
    }
  }

  if (data.summary.reviewedAnswers >= 5 && data.summary.acceptanceRate >= 70) {
    return {
      title: "Taslaklar çoğunlukla olduğu gibi kullanılıyor",
      description: `Kullanıcı tarafından gönderilen ${formatCount(data.summary.reviewedAnswers)} AI yanıtının ${formatCount(data.answers.acceptedUnchanged)} tanesi değiştirilmeden onaylandı.`,
      actionLabel: "Son yanıtları incele",
      actionHref: APP_ROUTES.dashboard.inbox,
      icon: CheckmarkCircle01Icon,
      tone: "border-primary/20 bg-primary/[0.045] dark:bg-primary/[0.07]",
      iconTone: "bg-primary/10 text-primary",
    }
  }

  if (data.draftDecisions.needsReview > data.draftDecisions.ready) {
    return {
      title: "İnsan kontrolü bu dönemde öne çıkıyor",
      description: `${formatCount(data.draftDecisions.needsReview)} taslak, eksik bilgi veya düşük güven gibi nedenlerle incelemeye bırakıldı.`,
      actionLabel: "Bekleyenleri incele",
      actionHref: APP_ROUTES.dashboard.inbox,
      icon: AlertCircleIcon,
      tone: "border-amber-500/20 bg-amber-500/[0.045] dark:bg-amber-500/[0.07]",
      iconTone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    }
  }

  return {
    title: "AI yanıt performansı ölçülüyor",
    description: `${formatCount(data.summary.uniqueQuestions)} soru için ${formatCount(data.summary.totalDrafts)} taslak üretildi. Daha çok yanıt gönderildikçe kullanım sonuçları belirginleşecek.`,
    actionLabel: "Gelen kutusunu aç",
    actionHref: APP_ROUTES.dashboard.inbox,
    icon: AiSparklesIcon,
    tone: "border-border bg-card",
    iconTone: "bg-primary/10 text-primary",
  }
}

export function PerformanceOverview({ data }: { data: AiPerformance }) {
  const state = getOverviewState(data)
  const metrics = [
    {
      label: "Ortalama AI güveni",
      value: formatPercent(data.summary.averageConfidence * 100),
    },
    {
      label: "Gönderim başarısı",
      value:
        data.delivery.successRate === null
          ? "—"
          : formatPercent(data.delivery.successRate),
    },
    {
      label: "Aktif yanıt modu",
      value: automationLabels[data.automation.mode],
    },
  ]

  return (
    <section
      aria-labelledby="performance-overview-title"
      className={`overflow-hidden rounded-xl border ${state.tone}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-start gap-4 p-5 sm:flex-row sm:p-6">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${state.iconTone}`}
          >
            <HugeiconsIcon icon={state.icon} className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Bu dönemin kısa özeti
            </p>
            <h2
              id="performance-overview-title"
              className="mt-1.5 text-base font-semibold tracking-tight"
            >
              {state.title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              {state.description}
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 bg-card"
          >
            <Link href={state.actionHref}>
              {state.actionLabel}
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </Button>
        </div>

        <dl className="grid grid-cols-3 border-t border-border/70">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`min-w-0 px-4 py-3.5 sm:px-5 ${index > 0 ? "border-l border-border/70" : ""}`}
            >
              <dt className="text-[10px] font-medium text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="mt-1.5 truncate text-sm font-semibold tracking-tight tabular-nums sm:text-base">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
