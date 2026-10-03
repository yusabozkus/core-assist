"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
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
  confidence: {
    label: "AI güveni · yüksek olması iyi",
    color: "var(--primary)",
  },
  review: {
    label: "Kontrol ihtiyacı · düşük olması iyi",
    color: "var(--chart-3)",
  },
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
      drafts: intent.totalDrafts,
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
            Soru türlerine göre AI performansı
          </h2>
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
            <SelectItem value="CONFIDENCE">En düşük AI güveni</SelectItem>
            <SelectItem value="REVIEW">En çok kontrol gereken</SelectItem>
          </SelectContent>
        </Select>
      </header>
      {ordered.length ? (
        <div className="px-5 sm:px-6">
          {chartData.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/60 py-3 text-[10px]">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-sm bg-primary" />
                  <span>
                    <strong className="font-medium text-foreground">
                      AI güveni
                    </strong>{" "}
                    · yüksek olması iyi
                  </span>
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-sm bg-chart-3" />
                  <span>
                    <strong className="font-medium text-foreground">
                      Kontrol ihtiyacı
                    </strong>{" "}
                    · düşük olması iyi
                  </span>
                </span>
              </div>
              <div className="themed-scrollbar overflow-x-auto pt-5">
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[310px] w-full min-w-[620px]"
                  aria-label="Soru türlerinin AI güveni ve insan kontrolü ihtiyacı"
                >
                  <BarChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 22, right: 10, bottom: 4, left: 0 }}
                    barSize={18}
                    barGap={5}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 4" />
                    <XAxis
                      dataKey="name"
                      type="category"
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 10 }}
                      height={34}
                    />
                    <YAxis
                      type="number"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickLine={false}
                      axisLine={false}
                      width={38}
                      tickFormatter={(value) => `%${value}`}
                      tick={{ fontSize: 10 }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                      isAnimationActive={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex w-full items-center justify-between gap-5">
                              <span className="text-muted-foreground">
                                {name === "confidence"
                                  ? "AI güveni"
                                  : "Kontrol ihtiyacı"}
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatPercent(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar
                      dataKey="confidence"
                      fill="var(--color-confidence)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    >
                      <LabelList
                        position="top"
                        formatter={(value) => formatPercent(Number(value))}
                        className="fill-foreground text-[9px]"
                      />
                    </Bar>
                    <Bar
                      dataKey="review"
                      fill="var(--color-review)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    >
                      <LabelList
                        position="top"
                        formatter={(value) => formatPercent(Number(value))}
                        className="fill-foreground text-[9px]"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              <p className="my-4 text-[10px] text-muted-foreground">
                Seçili sıralamadaki ilk {chartData.length} soru türü gösterilir.
                Sütunların üzerindeki değerler doğrudan karşılaştırılabilir.
              </p>
            </>
          )}
          <details className="group border-t border-border">
            <summary className="cursor-pointer py-4 text-xs font-medium outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring">
              Ayrıntılı sonuçları göster ({ordered.length} soru türü)
            </summary>
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.5fr)_repeat(3,minmax(4.5rem,0.5fr))] gap-4 border-b border-border pb-3 text-[10px] text-muted-foreground lg:grid"
            >
              <span>Soru türü</span>
              <span>Ortalama güven</span>
              <span>Kontrol ihtiyacı</span>
              <span>Otomatik gönderime uygun</span>
              <span>Kullanıcı düzenledi</span>
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
                        Kontrol ihtiyacı
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
                        Otomatik gönderime uygun
                      </p>
                      <p className="text-xs font-medium tabular-nums">
                        {intent.totalDrafts
                          ? formatPercent(intent.autoSendEligibilityRate)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground lg:hidden">
                        Kullanıcı düzenledi
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
        Bir soru birden fazla konu içerebilir. Az sayıda taslağa sahip soru
        türlerinde oranlar daha hızlı değişebilir.
      </p>
    </section>
  )
}
