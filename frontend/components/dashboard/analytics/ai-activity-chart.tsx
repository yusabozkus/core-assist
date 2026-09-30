"use client"

import { useId, useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type ActivityPoint = { date: string; drafts: number; sent: number }

const number = new Intl.NumberFormat("tr-TR")
const compactNumber = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const chartConfig = {
  drafts: { label: "Üretilen taslak", color: "var(--primary)" },
  sent: { label: "Müşteriye gönderilen", color: "var(--chart-4)" },
} satisfies ChartConfig

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function dateLabel(date: string, granularity: "day" | "month", full = false) {
  const value = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(value.getTime())) return date

  return new Intl.DateTimeFormat("tr-TR", {
    ...(granularity === "day" ? { day: "numeric" } : {}),
    month: full ? "long" : "short",
    ...(full || granularity === "month" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(value)
}

function axisCeiling(maximum: number) {
  const targetStep = Math.max(1, maximum / 4)
  const magnitude = 10 ** Math.floor(Math.log10(targetStep))
  const step =
    [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= targetStep) ?? 10
  return Math.ceil(step * magnitude) * 4
}

export function AiActivityChart({
  trend,
  granularity,
}: {
  trend: ActivityPoint[]
  granularity: "day" | "month"
}) {
  const id = useId()
  const chart = useMemo(() => {
    const points = trend
      .map((point) => ({
        ...point,
        drafts: safeCount(point.drafts),
        sent: safeCount(point.sent),
      }))
      .sort((left, right) => left.date.localeCompare(right.date))
    const maximum = points.reduce(
      (result, point) => Math.max(result, point.drafts, point.sent),
      0
    )
    const ceiling = axisCeiling(maximum)
    return {
      points,
      ceiling,
      ticks: [0, 1, 2, 3, 4].map((step) => (ceiling * step) / 4),
      hasActivity: maximum > 0,
      drafts: points.reduce((total, point) => total + point.drafts, 0),
      sent: points.reduce((total, point) => total + point.sent, 0),
    }
  }, [trend])

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {granularity === "month"
              ? "Aylara göre hareket"
              : "Günlere göre hareket"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full bg-primary"
            />
            Üretilen
            <strong className="font-semibold text-foreground tabular-nums">
              {number.format(chart.drafts)}
            </strong>
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="w-4 border-t-2 border-dashed border-chart-4"
            />
            Gönderilen
            <strong className="font-semibold text-foreground tabular-nums">
              {number.format(chart.sent)}
            </strong>
          </span>
        </div>
      </header>

      <div className="relative mt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
          aria-label="Tarihe göre taslak üretimi ve AI destekli gönderim grafiği"
        >
          <LineChart
            accessibilityLayer
            data={chart.points}
            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
            desc="Tarihler arasında sağ ve sol ok tuşlarıyla gezinin. Ayrıntılı veriler grafiğin altındaki tabloda bulunur."
          >
            <CartesianGrid vertical={false} strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={28}
              interval="preserveStartEnd"
              padding={{ left: 8, right: 8 }}
              tickFormatter={(value) => dateLabel(String(value), granularity)}
              fontSize={10}
              height={32}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={40}
              allowDecimals={false}
              domain={[0, chart.ceiling]}
              ticks={chart.ticks}
              tickFormatter={(value) => compactNumber.format(Number(value))}
              fontSize={10}
            />
            <ChartTooltip
              isAnimationActive={false}
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "3 4",
                strokeOpacity: 0.4,
              }}
              content={
                <ChartTooltipContent
                  className="min-w-44 border border-border shadow-sm"
                  labelFormatter={(value) =>
                    dateLabel(String(value), granularity, true)
                  }
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">
                        {name === "drafts"
                          ? "Üretilen taslak"
                          : "Müşteriye gönderilen"}
                      </span>
                      <strong className="ml-auto pl-3 font-medium tabular-nums">
                        {number.format(safeCount(Number(value)))}
                      </strong>
                    </div>
                  )}
                />
              }
            />
            <Line
              dataKey="drafts"
              type="linear"
              stroke="var(--color-drafts)"
              strokeWidth={2.5}
              dot={chart.points.length === 1 ? { r: 4 } : false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="sent"
              type="linear"
              stroke="var(--color-sent)"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={chart.points.length === 1 ? { r: 4 } : false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
        {!chart.hasActivity && (
          <p className="pointer-events-none absolute inset-x-10 top-20 mx-auto max-w-60 bg-card px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
            Bu dönemde henüz taslak veya gönderim kaydı yok.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-border pt-4">
        <p className="max-w-lg text-[11px] leading-5 text-muted-foreground">
          Taslak üretildiği güne, yanıt ise müşteriye gönderildiği güne yazılır.
          Bu nedenle iki çizginin aynı olması gerekmez.
        </p>
        {chart.points.length > 0 && (
          <details className="w-full text-xs">
            <summary className="w-fit cursor-pointer rounded-sm py-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Verileri tablo olarak göster
            </summary>
            <div className="themed-scrollbar mt-3 max-h-60 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs tabular-nums">
                <caption className="sr-only">
                  Dönem içindeki taslak ve AI destekli gönderim sayıları
                </caption>
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Tarih
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Taslak
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Gönderim
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chart.points.map((point, index) => (
                    <tr key={`${point.date}-${index}`}>
                      <th scope="row" className="px-3 py-2 font-normal">
                        {dateLabel(point.date, granularity, true)}
                      </th>
                      <td className="px-3 py-2 text-right">
                        {number.format(point.drafts)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {number.format(point.sent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  )
}
