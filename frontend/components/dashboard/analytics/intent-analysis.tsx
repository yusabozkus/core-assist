"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiPerformance } from "@/types/ai-performance"
import {
  boundedPercent,
  formatCount,
  formatPercent,
  intentLabels,
} from "./analytics-format"

type Sort = "VOLUME" | "CONFIDENCE" | "REVIEW"

const chartConfig = {
  confidence: { label: "Ortalama güven", color: "var(--primary)" },
  review: { label: "İnceleme oranı", color: "var(--chart-3)" },
} satisfies ChartConfig

export function IntentAnalysis({
  intents,
}: {
  intents: AiPerformance["intents"]
}) {
  const [sort, setSort] = useState<Sort>("VOLUME")
  const ordered = [...intents].sort((a, b) => {
    const difference =
      sort === "CONFIDENCE"
        ? a.averageConfidence - b.averageConfidence
        : sort === "REVIEW"
          ? b.needsReviewRate - a.needsReviewRate
          : b.totalDrafts - a.totalDrafts
    return (
      difference ||
      b.totalDrafts - a.totalDrafts ||
      a.intent.localeCompare(b.intent)
    )
  })
  const chartData = ordered
    .filter((intent) => intent.totalDrafts > 0)
    .slice(0, 6)
    .map((intent) => ({
      name: intentLabels[intent.intent],
      confidence: boundedPercent(intent.averageConfidence * 100),
      review: boundedPercent(intent.needsReviewRate),
    }))
  return (
    <section
      aria-labelledby="intent-analysis-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 id="intent-analysis-title" className="text-sm font-semibold">
            Soru türlerine göre performans
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Güven puanını gerçek inceleme ve düzenleme sonuçlarıyla
            karşılaştırın.
          </p>
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger
            size="sm"
            aria-label="Soru türlerini sırala"
            className="min-w-40 rounded-lg border-border bg-background text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VOLUME">En çok taslak</SelectItem>
            <SelectItem value="CONFIDENCE">En düşük güven</SelectItem>
            <SelectItem value="REVIEW">En çok inceleme</SelectItem>
          </SelectContent>
        </Select>
      </header>
      {ordered.length ? (
        <div className="px-5 sm:px-6">
          {chartData.length > 0 && (
            <>
              <ChartContainer
                config={chartConfig}
                className="aspect-auto w-full"
                style={{ height: Math.max(190, chartData.length * 52 + 56) }}
                aria-label="Soru türlerinin güven ve inceleme oranları"
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                  barSize={10}
                  barGap={4}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={85}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `%${value}`}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip
                    cursor={false}
                    isAnimationActive={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-5">
                            <span className="text-muted-foreground">
                              {chartConfig[name as keyof typeof chartConfig]
                                ?.label ?? String(name)}
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatPercent(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend
                    content={
                      <ChartLegendContent className="flex-wrap text-[11px]" />
                    }
                  />
                  <Bar
                    dataKey="confidence"
                    fill="var(--color-confidence)"
                    radius={[0, 3, 3, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="review"
                    fill="var(--color-review)"
                    radius={[0, 3, 3, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
              <p className="my-4 text-[10px] text-muted-foreground">
                Seçili sıralamadaki ilk {chartData.length} soru türü
                gösteriliyor.
              </p>
            </>
          )}
          <details className="group border-t border-border">
            <summary className="cursor-pointer py-4 text-xs font-medium outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring">
              Tüm soru türleri ve gönderim sonuçları ({ordered.length})
            </summary>
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.5fr)_repeat(3,minmax(4.5rem,0.5fr))] gap-4 border-b border-border pb-3 text-[10px] text-muted-foreground lg:grid"
            >
              <span>Soru türü</span>
              <span>Ortalama güven</span>
              <span>İnceleme</span>
              <span>Gönderime uygun</span>
              <span>Düzenleme</span>
            </div>
            <div className="divide-y divide-border/60">
              {ordered.map((intent) => (
                <div
                  key={intent.intent}
                  className="grid gap-4 py-4 lg:grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.5fr)_repeat(3,minmax(4.5rem,0.5fr))] lg:items-center"
                >
                  <div className="flex items-baseline justify-between gap-3 lg:block">
                    <h3 className="text-xs font-medium">
                      {intentLabels[intent.intent]}
                    </h3>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatCount(intent.totalDrafts)} taslak
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] text-muted-foreground lg:hidden">
                      Ortalama güven
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold tabular-nums">
                        {intent.totalDrafts
                          ? formatPercent(intent.averageConfidence * 100)
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 lg:contents">
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground lg:hidden">
                        İnceleme
                      </p>
                      <p
                        className={`text-xs font-medium tabular-nums ${intent.needsReviewRate > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                      >
                        {intent.totalDrafts
                          ? formatPercent(intent.needsReviewRate)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground lg:hidden">
                        Gönderime uygun
                      </p>
                      <p className="text-xs font-medium tabular-nums">
                        {intent.totalDrafts
                          ? formatPercent(intent.autoSendEligibilityRate)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground lg:hidden">
                        Düzenleme
                      </p>
                      <p className="text-xs font-medium tabular-nums">
                        {intent.reviewedAnswers
                          ? formatPercent(intent.editRate)
                          : "—"}
                      </p>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        {intent.reviewedAnswers
                          ? `${formatCount(intent.reviewedAnswers)} kullanıcı gönderimi`
                          : "Kullanıcı gönderimi yok"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <p className="px-6 pt-3 pb-8 text-center text-xs text-muted-foreground">
          Soru türü analizi için henüz taslak bulunmuyor.
        </p>
      )}
      <p className="border-t border-border px-5 py-3 text-[10px] leading-5 text-muted-foreground sm:px-6">
        Bir soru birden fazla konu içerebilir. Az taslaklı kategorilerde oranlar
        daha değişkendir; güven puanı tek başına gönderim kararı vermez.
      </p>
    </section>
  )
}
