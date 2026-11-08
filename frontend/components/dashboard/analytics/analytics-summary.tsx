import {
  AiEditingIcon,
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, formatPercent } from "./analytics-format"
import { PeriodChange } from "./period-change"
import { MetricHelp } from "./metric-help"

export function AnalyticsSummary({ data }: { data: AiPerformance }) {
  const comparison = data.comparison
  const items = [
    {
      title: "AI taslakları",
      value: formatCount(data.summary.totalDrafts),
      icon: AiSparklesIcon,
      description: `${formatCount(data.summary.uniqueQuestions)} farklı soruya ait`,
      explanation:
        "Seçili dönemde oluşturulan AI taslaklarının sayısıdır. Aynı soru için tekrar üretilen taslaklar ayrı sayılır.",
      iconTone: "bg-primary/10 text-primary",
      comparison: comparison ? (
        <PeriodChange
          kind="count"
          current={data.summary.totalDrafts}
          previous={comparison.totalDrafts}
        />
      ) : null,
    },
    {
      title: "AI destekli yanıtlar",
      value: formatCount(data.answers.aiAssisted),
      icon: SentIcon,
      description: data.answers.totalSent
        ? `Gönderilen ${formatCount(data.answers.totalSent)} yanıtın ${formatPercent(data.summary.aiCoverageRate)}’i`
        : "Henüz yanıt gönderilmedi",
      explanation:
        "AI taslağı kullanılarak gönderilen yanıtların, müşteriye gönderilen tüm yanıtlara oranıdır. Düzenlenen ve otomatik gönderilen AI yanıtları dahildir; henüz gönderilmeyen taslaklar dahil değildir.",
      iconTone: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
      comparison: comparison ? (
        <PeriodChange
          kind="count"
          current={data.answers.aiAssisted}
          previous={comparison.aiAssisted}
        />
      ) : null,
    },
    {
      title: "Değişmeden kullanılan",
      value: data.summary.reviewedAnswers
        ? formatPercent(data.summary.acceptanceRate)
        : "—",
      icon: CheckmarkCircle01Icon,
      description: data.summary.reviewedAnswers
        ? `${formatCount(data.answers.acceptedUnchanged)} / ${formatCount(data.summary.reviewedAnswers)} kullanıcı onaylı AI yanıtı`
        : "Henüz onaylı gönderim yok",
      explanation:
        "Kullanıcının değiştirmeden gönderdiği AI yanıtları / kullanıcının onaylayarak gönderdiği tüm AI yanıtları. Düzenlenen yanıtlar toplamda yer alır; otomatik gönderimler ve AI kullanılmadan yazılan yanıtlar hariçtir. Bu oran tek başına yanıt doğruluğunu ölçmez.",
      iconTone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      comparison: comparison ? (
        <PeriodChange
          kind="rate"
          improvement="up"
          current={
            data.summary.reviewedAnswers ? data.summary.acceptanceRate : null
          }
          previous={comparison.acceptanceRate}
        />
      ) : null,
    },
    {
      title: "Dönemde incelemeye ayrılan",
      value: data.summary.totalDrafts
        ? formatPercent(data.summary.needsReviewRate)
        : "—",
      icon: AiEditingIcon,
      description: `${formatCount(data.draftDecisions.needsReview)} / ${formatCount(data.summary.totalDrafts)} taslak`,
      explanation:
        "İnceleme kararı verilen taslakların, dönemde üretilen tüm taslaklara oranıdır. Aynı soruya ait tekrar üretilen taslaklar ayrı sayılır. Bu, şu anda inceleme bekleyen soru sayısı değildir.",
      iconTone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      comparison: comparison ? (
        <PeriodChange
          kind="rate"
          improvement="down"
          current={
            data.summary.totalDrafts ? data.summary.needsReviewRate : null
          }
          previous={comparison.needsReviewRate}
        />
      ) : null,
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
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8 ${item.iconTone}`}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  className="size-3.5 sm:size-4"
                />
              </span>
              <h3 className="min-w-0 text-[11px] leading-4 font-medium text-muted-foreground sm:text-xs">
                {item.title}
              </h3>
            </div>
            <MetricHelp label={item.title} description={item.explanation} />
          </div>
          <p className="mt-4 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-[32px]">
            {item.value}
          </p>
          {item.comparison}
          <p className="mt-auto pt-2 text-[10px] leading-4 text-muted-foreground sm:pt-3 sm:text-[11px] sm:leading-5">
            {item.description}
          </p>
        </div>
      ))}
    </section>
  )
}
