"use client"

import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AdminOverview } from "@/types/admin-overview"

const chartConfig = {
  active: { label: "Aktif", color: "var(--chart-2)" },
  trialing: { label: "Deneme", color: "var(--chart-1)" },
  pastDue: { label: "Gecikmiş", color: "var(--destructive)" },
  paused: { label: "Duraklatılmış", color: "var(--chart-3)" },
  inactive: { label: "İptal / süresi dolmuş", color: "var(--chart-5)" },
} satisfies ChartConfig

const number = new Intl.NumberFormat("tr-TR")

export function AdminSubscriptionDistributionChart({
  metrics,
}: {
  metrics: AdminOverview["metrics"]["subscriptions"]
}) {
  const segments = [
    { key: "active", label: "Aktif", value: metrics.active },
    { key: "trialing", label: "Deneme", value: metrics.trialing },
    { key: "pastDue", label: "Gecikmiş", value: metrics.pastDue },
    { key: "paused", label: "Duraklatılmış", value: metrics.paused },
    {
      key: "inactive",
      label: "İptal / süresi dolmuş",
      value: metrics.canceled + metrics.expired,
    },
  ].map((segment) => ({
    ...segment,
    fill: `var(--color-${segment.key})`,
  }))
  const total = metrics.total

  return (
    <div className="grid items-center gap-5 p-5 sm:grid-cols-[190px_1fr] sm:px-6">
      <div className="relative mx-auto size-44">
        <ChartContainer
          config={chartConfig}
          className="size-full"
          aria-label={`Abonelik dağılımı: toplam ${number.format(total)} abonelik`}
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
          <span className="mt-1 text-[11px] text-muted-foreground">
            toplam abonelik
          </span>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
            <dd className="text-sm font-semibold tabular-nums">
              {number.format(segment.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
