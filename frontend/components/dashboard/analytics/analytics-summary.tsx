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
      title: "Üretilen AI taslağı",
      value: formatCount(data.summary.totalDrafts),
      icon: AiSparklesIcon,
      description: `${formatCount(data.summary.uniqueQuestions)} farklı müşteri sorusu için üretildi.`,
      tone: "text-primary",
    },
    {
      title: "Müşteriye ulaşan AI yanıtı",
      value: formatCount(data.answers.aiAssisted),
      icon: SentIcon,
      description: data.answers.totalSent
        ? `Gönderilen tüm yanıtların ${formatPercent(data.summary.aiCoverageRate)}’i AI desteği kullandı.`
        : "Henüz müşteriye gönderilmiş bir yanıt yok.",
      tone: "text-primary",
    },
    {
      title: "Değişikliksiz kullanılan",
      value: data.summary.reviewedAnswers
        ? formatPercent(data.summary.acceptanceRate)
        : "—",
      icon: CheckmarkCircle01Icon,
      description: data.summary.reviewedAnswers
        ? `${formatCount(data.summary.reviewedAnswers)} kullanıcı gönderiminin ${formatCount(data.answers.acceptedUnchanged)} tanesi olduğu gibi onaylandı.`
        : "Bu oran için henüz kullanıcı onaylı gönderim yok.",
      tone: "text-primary",
    },
    {
      title: "İnceleme gerektiren",
      value: data.summary.totalDrafts
        ? formatPercent(data.summary.needsReviewRate)
        : "—",
      icon: AiEditingIcon,
      description: `${formatCount(data.draftDecisions.needsReview)} taslak kullanıcı kontrolüne bırakıldı.`,
      tone: "text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <section
      aria-label="Temel AI performans göstergeleri"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.title}
          className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground">
              {item.title}
            </h2>
            <HugeiconsIcon
              icon={item.icon}
              className={`size-4 shrink-0 ${item.tone}`}
            />
          </div>
          <p className="mt-4 text-[32px] leading-none font-semibold tracking-tight tabular-nums">
            {item.value}
          </p>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {item.description}
          </p>
        </div>
      ))}
    </section>
  )
}
