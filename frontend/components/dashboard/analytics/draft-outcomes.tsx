"use client"

import { Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, formatPercent } from "./analytics-format"

const chartConfig = {
  ready: { label: "Gönderime hazır", color: "var(--primary)" },
  review: { label: "İnceleme gerekli", color: "var(--chart-3)" },
  blocked: { label: "Yanıtlanmayacak", color: "var(--chart-5)" },
} satisfies ChartConfig

export function DraftOutcomes({ data }: { data: AiPerformance }) {
  const total = data.summary.totalDrafts
  const segments = [
    {
      key: "ready",
      label: "Gönderime hazır",
      value: data.draftDecisions.ready,
      color: "var(--primary)",
    },
    {
      key: "review",
      label: "Kontrol edilmeli",
      value: data.draftDecisions.needsReview,
      color: "var(--chart-3)",
    },
    {
      key: "blocked",
      label: "Yanıtlanmayacak",
      value: data.draftDecisions.blocked,
      color: "var(--chart-5)",
    },
  ]
  const chartData = segments.map((segment) => ({
    ...segment,
    fill: `var(--color-${segment.key})`,
  }))
  return (
    <section
      aria-labelledby="draft-outcomes-title"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="draft-outcomes-title" className="text-sm font-semibold">
        Taslakların ilk kararı
      </h2>
      <div className="relative mx-auto my-5 size-44">
        <ChartContainer
          config={chartConfig}
          className="size-full"
          aria-label={`Taslak kararları: ${formatCount(total)} taslak`}
        >
          <PieChart accessibilityLayer>
            {total > 0 && (
              <ChartTooltip
                isAnimationActive={false}
                content={<ChartTooltipContent nameKey="key" hideLabel />}
              />
            )}
            <Pie
              data={
                total
                  ? chartData
                  : [{ key: "empty", value: 1, fill: "var(--muted)" }]
              }
              dataKey="value"
              nameKey="key"
              innerRadius={62}
              outerRadius={77}
              paddingAngle={total ? 2 : 0}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="max-w-28 truncate text-2xl font-semibold tracking-tight tabular-nums"
            title={formatCount(total)}
          >
            {formatCount(total)}
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">
            üretilen taslak
          </span>
        </div>
      </div>
      <dl className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <dt className="flex flex-1 items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatCount(segment.value)}
              <span className="ml-2 inline-block w-12 text-right text-[10px] font-normal text-muted-foreground">
                {total ? formatPercent((segment.value / total) * 100) : "—"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-t border-border pt-4 text-[10px] leading-5 text-muted-foreground">
        Bir taslak “gönderime hazır” olsa bile aktif yanıt moduna göre kullanıcı
        onayı bekleyebilir.
      </p>
    </section>
  )
}
