import {
  AiEditingIcon,
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, formatPercent } from "./analytics-format"

export function AnalyticsSummary({ data }: { data: AiPerformance }) {
  const items = [
    {
      title: "AI taslakları",
      value: formatCount(data.summary.totalDrafts),
      icon: AiSparklesIcon,
      description: `${formatCount(data.summary.uniqueQuestions)} farklı soruya ait`,
      iconTone: "bg-primary/10 text-primary",
    },
    {
      title: "AI destekli yanıtlar",
      value: formatCount(data.answers.aiAssisted),
      icon: SentIcon,
      description: data.answers.totalSent
        ? `Gönderilenlerin ${formatPercent(data.summary.aiCoverageRate)}’i`
        : "Henüz yanıt gönderilmedi",
      iconTone: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
    {
      title: "Değişmeden kullanılan",
      value: data.summary.reviewedAnswers
        ? formatPercent(data.summary.acceptanceRate)
        : "—",
      icon: CheckmarkCircle01Icon,
      description: data.summary.reviewedAnswers
        ? `${formatCount(data.answers.acceptedUnchanged)} yanıt olduğu gibi gönderildi`
        : "Henüz onaylı gönderim yok",
      iconTone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    {
      title: "İncelemeye ayrılan",
      value: data.summary.totalDrafts
        ? formatPercent(data.summary.needsReviewRate)
        : "—",
      icon: AiEditingIcon,
      description: `${formatCount(data.draftDecisions.needsReview)} taslak kontrol gerektirdi`,
      iconTone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
  ]

  return (
    <section
      aria-label="Temel AI performans göstergeleri"
      className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.title}
          className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 sm:p-5"
        >
          <span
            className={`flex size-8 items-center justify-center rounded-lg sm:size-9 ${item.iconTone}`}
          >
            <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
          </span>
          <h3 className="mt-3 min-h-8 text-[11px] leading-4 font-medium text-muted-foreground sm:min-h-0 sm:text-xs">
            {item.title}
          </h3>
          <p className="mt-1 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:mt-4 sm:text-[32px]">
            {item.value}
          </p>
          <p className="mt-auto pt-2 text-[10px] leading-4 text-muted-foreground sm:pt-3 sm:text-[11px] sm:leading-5">
            {item.description}
          </p>
        </div>
      ))}
    </section>
  )
}
