"use client"

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AdminAiUsage } from "@/types/admin-ai-usage"

const number = new Intl.NumberFormat("tr-TR")
const compactNumber = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const decisionChartConfig = {
  ready: { label: "Gönderime hazır", color: "var(--chart-2)" },
  review: { label: "İnceleme gerekli", color: "var(--chart-3)" },
  blocked: { label: "Yanıt verilmemeli", color: "var(--chart-5)" },
} satisfies ChartConfig

const activityChartConfig = {
  drafts: { label: "Üretilen taslak", color: "var(--primary)" },
} satisfies ChartConfig

export function AdminDraftDecisionChart({ data }: { data: AdminAiUsage }) {
  const { summary } = data
  const total = summary.totalDrafts
  const segments = [
    { key: "ready", label: "Gönderime hazır", value: summary.readyForSend },
    { key: "review", label: "İnceleme gerekli", value: summary.needsReview },
    {
      key: "blocked",
      label: "Yanıt verilmemeli",
      value: summary.doNotReply,
    },
  ].map((segment) => ({
    ...segment,
    fill: `var(--color-${segment.key})`,
  }))

  return (
    <div className="grid items-center gap-5 p-5 sm:grid-cols-[190px_1fr] sm:px-6">
      <div className="relative mx-auto size-44">
        <ChartContainer
          config={decisionChartConfig}
          className="size-full"
          aria-label={`Taslak karar dağılımı: ${number.format(total)} taslak`}
        >
          <PieChart accessibilityLayer>
            {total > 0 ? (
              <ChartTooltip
                isAnimationActive={false}
                content={<ChartTooltipContent nameKey="key" hideLabel />}
              />
            ) : null}
            <Pie
              data={
                total > 0
                  ? segments
                  : [{ key: "empty", value: 1, fill: "var(--muted)" }]
              }
              dataKey="value"
              nameKey="key"
              innerRadius={59}
              outerRadius={77}
              paddingAngle={total > 0 ? 2 : 0}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {number.format(total)}
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">taslak</span>
        </div>
      </div>

      <dl className="space-y-3">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2.5"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.fill }}
            />
            <dt className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {segment.label}
            </dt>
            <dd className="text-right text-sm font-semibold tabular-nums">
              {number.format(segment.value)}
              <span className="ml-2 inline-block w-10 text-[10px] font-normal text-muted-foreground">
                {total ? `%${Math.round((segment.value / total) * 100)}` : "—"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AdminDailyDraftChart({
  data,
}: {
  data: AdminAiUsage["daily"]
}) {
  const maximum = Math.max(4, ...data.map((point) => point.drafts))
  const ceiling = Math.ceil(maximum / 4) * 4
  const hasActivity = data.some((point) => point.drafts > 0)
  const ticks = data
    .filter(
      (_, index) =>
        index === 0 ||
        index === Math.floor((data.length - 1) / 2) ||
        index === data.length - 1
    )
    .map((point) => point.date)

  return (
    <div className="relative px-5 pt-6 pb-5 sm:px-6">
      <ChartContainer
        config={activityChartConfig}
        className="aspect-auto h-60 w-full"
        aria-label="Günlük üretilen AI taslak sayısı"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barCategoryGap="30%"
          title="Günlük taslak hacmi"
          desc="Seçilen dönemde her gün üretilen AI taslak sayısı."
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={(value) => dateLabel(String(value))}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={20}
            height={28}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[0, ceiling]}
            ticks={[0, 1, 2, 3, 4].map((step) => (ceiling * step) / 4)}
            allowDecimals={false}
            tickFormatter={(value: number) => compactNumber.format(value)}
            tickLine={false}
            axisLine={false}
            width={42}
            tickMargin={8}
            tick={{ fontSize: 10 }}
          />
          <ChartTooltip
            isAnimationActive={false}
            cursor={{ fillOpacity: 0.35 }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => dateLabel(String(label), true)}
                formatter={(value, _name, item) => (
                  <div className="grid w-full gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-xs bg-primary" />
                      <span className="flex-1 text-muted-foreground">
                        Üretilen taslak
                      </span>
                      <strong className="font-mono font-medium tabular-nums">
                        {number.format(Number(value))}
                      </strong>
                    </div>
                    {typeof item.payload.averageConfidence === "number" ? (
                      <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-[10px]">
                        <span className="text-muted-foreground">
                          Ortalama güven
                        </span>
                        <span className="font-medium tabular-nums">
                          %{Math.round(item.payload.averageConfidence * 100)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="drafts"
            fill="var(--color-drafts)"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      {!hasActivity ? (
        <div className="pointer-events-none absolute inset-x-10 top-24 rounded-lg bg-card/95 px-4 py-3 text-center text-xs text-muted-foreground">
          Bu dönemde henüz taslak üretilmedi.
        </div>
      ) : null}
    </div>
  )
}

function dateLabel(value: string, full = false) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date)
}
