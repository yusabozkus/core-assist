import {
  AiSparklesIcon,
  AiEditingIcon,
  SentIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, formatPercent } from "./analytics-format"

export function AnalyticsSummary({ data }: { data: AiPerformance }) {
  const items = [
    {
      title: "AI destekli yanıt",
      value: formatCount(data.answers.aiAssisted),
      icon: SentIcon,
      detail: data.answers.totalSent
        ? `${formatCount(data.answers.totalSent)} gönderilen yanıtın ${formatPercent(data.summary.aiCoverageRate)}’i`
        : "Henüz gönderilen yanıt yok",
      caption: "Müşteriye gönderilen",
      tone: "text-primary",
    },
    {
      title: "Değiştirilmeden onay",
      value: data.summary.reviewedAnswers
        ? formatPercent(data.summary.acceptanceRate)
        : "—",
      icon: CheckmarkCircle01Icon,
      detail: data.summary.reviewedAnswers
        ? `${formatCount(data.summary.reviewedAnswers)} kullanıcı onayının ${formatCount(data.answers.acceptedUnchanged)} adedi`
        : "Kullanıcı onayıyla gönderim bekleniyor",
      caption: "Kullanıcının gönderdiği AI yanıtları",
      tone: "text-primary",
    },
    {
      title: "İnceleme kararı",
      value: data.summary.totalDrafts
        ? formatPercent(data.summary.needsReviewRate)
        : "—",
      icon: AiEditingIcon,
      detail: `${formatCount(data.draftDecisions.needsReview)} taslak için inceleme istendi`,
      caption: "Seçili dönemde üretilen taslaklar",
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Ortalama güven",
      value: data.summary.totalDrafts
        ? formatPercent(data.summary.averageConfidence * 100)
        : "—",
      icon: AiSparklesIcon,
      detail: `${formatCount(data.summary.totalDrafts)} taslağın güven puanı ortalaması`,
      caption: "AI tahmini · doğruluk ölçümü değildir",
      tone: "text-muted-foreground",
    },
  ]
  return (
    <section
      aria-label="AI performans özeti"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.title}
          className="min-w-0 rounded-xl border border-border bg-card p-5"
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
          <p className="mt-3 text-[11px] leading-5 text-foreground">
            {item.detail}
          </p>
          <p className="mt-3 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
            {item.caption}
          </p>
        </div>
      ))}
    </section>
  )
}
