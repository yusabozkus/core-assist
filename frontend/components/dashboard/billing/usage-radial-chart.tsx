"use client"

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  usage: { label: "Kullanım", color: "var(--primary)" },
} satisfies ChartConfig

export function UsageRadialChart({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const percentage = Math.max(0, Math.min(100, value))

  return (
    <div
      className="relative size-12 shrink-0"
      role="progressbar"
      aria-label={`${label} kullanımı`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-valuetext={`%${percentage} kullanıldı`}
    >
      <ChartContainer
        config={chartConfig}
        className="aspect-square size-full"
        initialDimension={{ width: 48, height: 48 }}
        aria-hidden="true"
      >
        <RadialBarChart
          data={[{ usage: percentage }]}
          startAngle={90}
          endAngle={-270}
          innerRadius={17}
          outerRadius={21}
          barSize={4}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <RadialBar
            dataKey="usage"
            background
            fill="var(--color-usage)"
            cornerRadius={4}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ChartContainer>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground tabular-nums">
        %{percentage}
      </span>
    </div>
  )
}
