import Link from "next/link"
import {
  AiEditingIcon,
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"

import { AiAnswerFlow } from "@/components/dashboard/overview/ai-answer-flow"
import { EmptyAiPerformance } from "@/components/dashboard/overview/empty-ai-performance"
import { IntentPerformance } from "@/components/dashboard/overview/intent-performance"
import { PerformanceMetric } from "@/components/dashboard/overview/performance-metric"
import { ProviderPerformance } from "@/components/dashboard/overview/provider-performance"
import { RecentAiActivity } from "@/components/dashboard/overview/recent-ai-activity"
import { cn } from "@/lib/utils"
import type { AiPerformance, AiPerformanceRange } from "@/types/ai-performance"
import type { StoreSummary } from "@/types/store"

const rangeOptions: Array<{ value: AiPerformanceRange; label: string }> = [
  { value: "7D", label: "7 gün" },
  { value: "30D", label: "30 gün" },
  { value: "90D", label: "90 gün" },
  { value: "ALL", label: "Tümü" },
]

export function AnalyticsClient({
  activeStore,
  performance,
  range,
}: {
  activeStore: StoreSummary
  performance: AiPerformance | null
  range: AiPerformanceRange
}) {
  const reviewedCount = performance
    ? performance.answers.acceptedUnchanged + performance.answers.edited
    : 0

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">{activeStore.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            AI Performansı
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Taslak kalitesini, kullanıcı tercihlerini ve otomatik gönderim
            politikasını gerçek sonuçlarla izleyin.
          </p>
        </div>

        <nav
          aria-label="Performans dönemi"
          className="inline-flex w-fit items-center rounded-lg border border-border bg-card p-1 shadow-xs"
        >
          {rangeOptions.map((option) => (
            <Link
              key={option.value}
              href={`/dashboard/analytics?range=${option.value}`}
              aria-current={range === option.value ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === option.value
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>

      {!performance ? (
        <section className="mt-7 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <p className="text-sm font-medium text-destructive">
            AI performans verileri şu anda alınamıyor.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Backend bağlantısını kontrol edip sayfayı yenileyebilirsiniz.
          </p>
        </section>
      ) : performance.summary.totalDrafts === 0 ? (
        <div className="mt-7">
          <EmptyAiPerformance />
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PerformanceMetric
              icon={CheckmarkCircle01Icon}
              label="Taslak kabul oranı"
              value={
                reviewedCount > 0
                  ? percent(performance.summary.acceptanceRate)
                  : "—"
              }
              description={
                reviewedCount > 0
                  ? `${performance.answers.acceptedUnchanged} taslak değiştirilmeden gönderildi`
                  : "Henüz kullanıcı tarafından gönderilen AI taslağı yok"
              }
              progress={performance.summary.acceptanceRate}
              tone="emerald"
            />
            <PerformanceMetric
              icon={AiEditingIcon}
              label="Düzenleme oranı"
              value={
                reviewedCount > 0 ? percent(performance.summary.editRate) : "—"
              }
              description={`${performance.answers.edited} taslak gönderilmeden önce düzenlendi`}
              progress={performance.summary.editRate}
              tone="amber"
            />
            <PerformanceMetric
              icon={SentIcon}
              label={
                performance.shadow.evaluated > 0
                  ? "Otomatik gönderime uygun"
                  : "Otomatik gönderim"
              }
              value={
                performance.shadow.evaluated > 0
                  ? performance.shadow.wouldAutoSend.toLocaleString("tr-TR")
                  : performance.answers.autoSent.toLocaleString("tr-TR")
              }
              description={
                performance.shadow.evaluated > 0
                  ? `${performance.shadow.evaluated.toLocaleString("tr-TR")} otomatik taslaktan`
                  : `${performance.answers.aiAssisted.toLocaleString("tr-TR")} AI destekli cevabın içinden`
              }
              progress={
                performance.shadow.evaluated > 0
                  ? performance.summary.shadowEligibilityRate
                  : undefined
              }
              tone="blue"
            />
            <PerformanceMetric
              icon={AiSparklesIcon}
              label="Ortalama güven"
              value={percent(performance.summary.averageConfidence * 100)}
              description={`${performance.summary.totalDrafts.toLocaleString("tr-TR")} taslak üzerinden hesaplandı`}
              progress={performance.summary.averageConfidence * 100}
            />
          </div>

          <div className="mt-5">
            <AiAnswerFlow data={performance} />
          </div>

          <div className="mt-5">
            <IntentPerformance intents={performance.intents} />
          </div>

          <div className="mt-5">
            <ProviderPerformance providers={performance.providers} />
          </div>

          <div className="mt-5">
            <RecentAiActivity activity={performance.recentActivity} />
          </div>
        </>
      )}
    </div>
  )
}

function percent(value: number) {
  return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
}
