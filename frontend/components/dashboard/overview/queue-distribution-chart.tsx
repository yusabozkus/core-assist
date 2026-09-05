"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { DashboardOverview, DashboardQueueState } from "@/types/dashboard"
import { queuePresentation } from "./dashboard-format"

const chartConfig = {
  READY: {
    label: queuePresentation.READY.label,
    color: "var(--color-emerald-500)",
  },
  REVIEW: {
    label: queuePresentation.REVIEW.label,
    color: "var(--color-amber-500)",
  },
  PROCESSING: {
    label: queuePresentation.PROCESSING.label,
    color: "var(--color-sky-500)",
  },
  PENDING: {
    label: queuePresentation.PENDING.label,
    color: "var(--color-slate-400)",
  },
  UNMATCHED: {
    label: queuePresentation.UNMATCHED.label,
    color: "var(--color-violet-500)",
  },
  FAILED: {
    label: queuePresentation.FAILED.label,
    color: "var(--color-red-500)",
  },
} satisfies ChartConfig

export function QueueDistributionChart({
  queue,
  states,
}: {
  queue: DashboardOverview["queue"]
  states: DashboardQueueState[]
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="mt-4 aspect-auto h-2 w-full overflow-hidden rounded-full bg-muted"
      initialDimension={{ width: 320, height: 8 }}
      aria-hidden="true"
    >
      <BarChart
        data={[queue.counts]}
        layout="vertical"
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        accessibilityLayer={false}
        barSize={8}
      >
        <XAxis type="number" domain={[0, Math.max(1, queue.total)]} hide />
        <YAxis type="category" hide />
        {states.map((state) => (
          <Bar
            key={state}
            dataKey={state}
            stackId="queue"
            fill={`var(--color-${state})`}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
