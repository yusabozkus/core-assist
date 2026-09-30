"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DashboardOverview } from "@/types/dashboard"
import { dashboardNumber as number, dayLabel } from "./dashboard-format"

const chartConfig = {
  incoming: { label: "Gelen", color: "var(--primary)" },
  answered: { label: "Yanıtlanan", color: "var(--chart-4)" },
} satisfies ChartConfig

export function QuestionVolumeChart({ data }: { data: DashboardOverview }) {
  const maximum = Math.max(
    4,
    ...data.activity.flatMap((day) => [day.incoming, day.answered])
  )
  const ceiling = Math.ceil(maximum / 4) * 4
  const hasActivity = data.activity.some(
    (day) => day.incoming > 0 || day.answered > 0
  )
  const dateTicks = data.activity
    .filter(
      (_, index) =>
        index === 0 ||
        index === Math.floor((data.activity.length - 1) / 2) ||
        index === data.activity.length - 1
    )
    .map((day) => day.date)

  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="activity-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="activity-title" className="text-sm font-semibold">
            Soru akışı
          </h2>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" />
            Gelen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-chart-4" />
            Yanıtlanan
          </span>
        </div>
      </header>
      <div className="relative mt-7">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-56 w-full"
        >
          <BarChart
            accessibilityLayer
            data={data.activity}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            barGap={3}
            barCategoryGap="25%"
            title="Günlük soru akışı"
            desc="Günlük gelen ve yanıtlanan soru sayıları. Günler arasında gezinmek için sağ ve sol ok tuşlarını kullanın."
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              ticks={dateTicks}
              tickFormatter={dayLabel}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={12}
              height={28}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={[0, ceiling]}
              ticks={[0, 1, 2, 3, 4].map((step) => (ceiling * step) / 4)}
              allowDecimals={false}
              tickFormatter={(value: number) => number.format(value)}
              tickLine={false}
              axisLine={false}
              width={44}
              tickMargin={8}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              isAnimationActive={false}
              cursor={{ fillOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => dayLabel(String(label))}
                  formatter={(value, name, item) => (
                    <>
                      <span
                        className="size-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label ??
                          name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {number.format(Number(value))}
                      </span>
                    </>
                  )}
                />
              }
            />
            <Bar
              dataKey="incoming"
              fill="var(--color-incoming)"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
            <Bar
              dataKey="answered"
              fill="var(--color-answered)"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        {!hasActivity && (
          <div className="pointer-events-none absolute inset-x-9 top-16 rounded-lg bg-card/95 px-4 py-3 text-center text-xs text-muted-foreground">
            Bu dönemde henüz soru hareketi yok.
          </div>
        )}
      </div>
      <p className="mt-5 text-[10px] leading-4 text-muted-foreground">
        Yanıtlar gönderildikleri güne aittir; önceki günlerden gelen soruları da
        içerebilir.
      </p>
    </section>
  )
}
