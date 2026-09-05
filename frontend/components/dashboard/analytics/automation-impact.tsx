"use client"

import Link from "next/link"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AiPerformance } from "@/types/ai-performance"
import {
  automationLabels,
  formatCount,
  formatPercent,
} from "./analytics-format"

const chartConfig = {
  automatic: { label: "Otomatik gönderim", color: "var(--primary)" },
  reviewed: { label: "Kullanıcı onaylı", color: "var(--chart-4)" },
} satisfies ChartConfig

export function AutomationImpact({ data }: { data: AiPerformance }) {
  const total = data.answers.aiAssisted
  const autoRate = total ? (data.answers.autoSent / total) * 100 : 0
  return (
    <section
      aria-labelledby="automation-impact-title"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="automation-impact-title" className="text-sm font-semibold">
          Otomasyonun katkısı
        </h2>
        <Link
          href={APP_ROUTES.dashboard.automations.root}
          className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[10px] font-medium hover:text-primary"
        >
          <span className="size-1 rounded-full bg-primary" />
          {automationLabels[data.automation.mode]}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </Link>
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatCount(data.answers.autoSent)}
        </strong>
        <span className="text-xs text-muted-foreground">
          yanıt otomatik gönderildi
        </span>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mt-4 aspect-auto h-7 w-full"
        aria-label="AI yanıtlarının gönderim dağılımı"
      >
        <BarChart
          accessibilityLayer
          layout="vertical"
          data={[
            {
              name: "Gönderilen",
              automatic: data.answers.autoSent,
              reviewed: data.summary.reviewedAnswers,
            },
          ]}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barSize={10}
        >
          <XAxis type="number" domain={[0, Math.max(total, 1)]} hide />
          <YAxis type="category" dataKey="name" hide />
          {total > 0 && (
            <ChartTooltip
              cursor={false}
              isAnimationActive={false}
              content={<ChartTooltipContent hideLabel />}
            />
          )}
          <Bar
            dataKey="automatic"
            stackId="delivery"
            fill="var(--color-automatic)"
            radius={[3, 0, 0, 3]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="reviewed"
            stackId="delivery"
            fill="var(--color-reviewed)"
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          Otomatik {total ? formatPercent(autoRate) : "—"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-chart-4" />
          Kullanıcı onaylı {formatCount(data.summary.reviewedAnswers)}
        </span>
      </div>
      <dl className="my-5 grid grid-cols-2 gap-5 border-y border-border py-4">
        <div>
          <dt className="text-[11px] text-muted-foreground">
            Politikayı geçen taslak
          </dt>
          <dd className="mt-1.5 text-lg font-semibold tabular-nums">
            {formatCount(data.automation.eligible)}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              / {formatCount(data.automation.evaluated)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">
            Gönderime uygun olmayan
          </dt>
          <dd className="mt-1.5 text-lg font-semibold tabular-nums">
            {formatCount(data.automation.withheld)}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {data.shadow.evaluated
          ? `${formatCount(data.shadow.evaluated)} otomatik taslağın ${formatCount(data.shadow.wouldAutoSend)} adedi gönderim koşullarını geçti. Bu modda gönderim kullanıcı onayı bekler.`
          : data.automation.evaluated
            ? "Uygunluk, taslak üretilirken mağazanın güven ve kanıt kurallarıyla değerlendirilir."
            : "Otomasyonla taslak üretildiğinde uygunluk sonuçları burada görünür."}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-[11px] text-muted-foreground">
        <span>
          Gönderim başarısı{" "}
          <strong className="ml-1 font-medium text-foreground">
            {data.delivery.successRate === null
              ? "—"
              : formatPercent(data.delivery.successRate)}
          </strong>
        </span>
        <span>
          Kuyrukta{" "}
          <strong className="ml-1 font-medium text-foreground">
            {formatCount(data.delivery.queued + data.delivery.processing)}
          </strong>
        </span>
        <span>
          Başarısız{" "}
          <strong
            className={
              data.delivery.failed
                ? "ml-1 font-medium text-destructive"
                : "ml-1 font-medium text-foreground"
            }
          >
            {formatCount(data.delivery.failed)}
          </strong>
        </span>
      </div>
    </section>
  )
}
