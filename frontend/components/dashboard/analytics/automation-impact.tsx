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
import { PeriodChange } from "./period-change"
import { MetricHelp } from "./metric-help"
import {
  automationLabels,
  formatCount,
  formatPercent,
} from "./analytics-format"

const chartConfig = {
  automatic: { label: "Otomatik gönderim", color: "var(--primary)" },
  reviewed: { label: "Kullanıcı onaylı", color: "var(--chart-4)" },
} satisfies ChartConfig

export function AutomationImpact({
  data,
  canManageStore,
  onInspectFailed,
}: {
  data: AiPerformance
  canManageStore: boolean
  onInspectFailed: () => void
}) {
  const total = data.answers.aiAssisted
  const autoRate = total ? (data.answers.autoSent / total) * 100 : 0
  return (
    <section
      aria-labelledby="automation-impact-title"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="automation-impact-title" className="text-sm font-semibold">
          Yanıtları kim gönderdi?
        </h2>
        {canManageStore ? (
          <Link
            href={APP_ROUTES.dashboard.automations.root}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[10px] font-medium hover:text-primary"
          >
            <span className="size-1 rounded-full bg-primary" />
            {automationLabels[data.automation.mode]}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </Link>
        ) : null}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatCount(data.answers.autoSent)}
        </strong>
        <span className="text-xs text-muted-foreground">
          yanıt otomatik gönderildi
        </span>
      </div>
      {data.comparison && (
        <PeriodChange
          kind="count"
          current={data.answers.autoSent}
          previous={data.comparison.autoSent}
        />
      )}
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
      <p className="mt-2 text-[10px] text-muted-foreground">
        Toplam {formatCount(total)} AI destekli gönderim üzerinden
      </p>
      <dl className="my-5 grid grid-cols-2 gap-5 border-y border-border py-4">
        <div>
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Otomatik gönderime uygun
            <MetricHelp
              label="Otomatik gönderime uygun"
              description="Otomatik taslak veya otomatik gönderim modunda değerlendirilen taslaklardan gönderim koşullarını geçenlerin sayısıdır. Uygun bulunması, yanıtın gönderildiği anlamına gelmez."
            />
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
            Kontrole bırakılan
          </dt>
          <dd className="mt-1.5 text-lg font-semibold tabular-nums">
            {formatCount(data.automation.withheld)}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {data.shadow.evaluated
          ? `${formatCount(data.shadow.evaluated)} taslağın ${formatCount(data.shadow.wouldAutoSend)} adedi otomatik gönderim koşullarını geçti. Test modunda oldukları için yine kullanıcı onayı beklediler.`
          : data.automation.evaluated
            ? "AI; güven, kanıt ve risk kurallarını geçen yanıtları otomatik gönderime uygun sayar."
            : "Otomatik taslak veya gönderim çalıştığında sonuçlar burada görünür."}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          Gönderim başarısı{" "}
          <MetricHelp
            label="Gönderim başarısı"
            description={`${formatCount(data.answers.aiAssisted)} başarılı / ${formatCount(data.answers.aiAssisted + data.delivery.failed)} sonuçlanan AI gönderimi. Kuyrukta ve işlemde olanlar hariçtir; yanıtın doğruluğunu ölçmez.`}
          />
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
        {data.delivery.failed > 0 ? (
          <button
            type="button"
            onClick={onInspectFailed}
            className="inline-flex items-center gap-1 rounded-sm text-destructive outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${formatCount(data.delivery.failed)} başarısız gönderimi görüntüle`}
          >
            Başarısız{" "}
            <strong className="ml-1 font-medium">
              {formatCount(data.delivery.failed)}
            </strong>
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </button>
        ) : (
          <span>
            Başarısız{" "}
            <strong className="ml-1 font-medium text-foreground">0</strong>
          </span>
        )}
      </div>
    </section>
  )
}
