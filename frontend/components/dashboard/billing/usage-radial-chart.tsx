"use client"

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  usage: { label: "Kullanım", color: "var(--primary)" },
} satisfies ChartConfig

export function UsageRadialChart({
  value,
  label,
  size = "sm",
}: {
  value: number
  label: string
  size?: "sm" | "lg"
}) {
  const percentage = Math.max(0, Math.min(100, value))
  const dimensions =
    size === "lg"
      ? {
          className: "size-28",
          pixels: 112,
          innerRadius: 40,
          outerRadius: 48,
          barSize: 8,
          textClassName: "text-lg",
        }
      : {
          className: "size-12",
          pixels: 48,
          innerRadius: 17,
          outerRadius: 21,
          barSize: 4,
          textClassName: "text-[10px]",
        }

  return (
    <div
      className={`relative shrink-0 ${dimensions.className}`}
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
        initialDimension={{
          width: dimensions.pixels,
          height: dimensions.pixels,
        }}
        aria-hidden="true"
      >
        <RadialBarChart
          data={[{ usage: percentage }]}
          startAngle={90}
          endAngle={-270}
          innerRadius={dimensions.innerRadius}
          outerRadius={dimensions.outerRadius}
          barSize={dimensions.barSize}
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
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center font-semibold text-foreground tabular-nums ${dimensions.textClassName}`}
      >
        %{percentage}
      </span>
    </div>
  )
}
