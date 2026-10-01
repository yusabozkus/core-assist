"use client"

import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"
import type { AiPerformance } from "@/types/ai-performance"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCount, reviewReasonLabels } from "./analytics-format"

const chartConfig = {
  count: { label: "Taslak", color: "var(--chart-3)" },
} satisfies ChartConfig
const shortLabels: Record<string, string> = {
  MISSING_INFORMATION: "Eksik bilgi",
  MISSING_EVIDENCE: "Eksik kanıt",
  PARTIAL_ANSWER: "Kısmi yanıt",
  LOW_CONFIDENCE: "Düşük güven",
  RISK_DETECTED: "Risk kontrolü",
  REVIEW_REQUIRED: "Ek inceleme",
  UNSUPPORTED_CLAIM: "Kanıtsız ifade",
  STOCK_CONTRADICTION: "Stok çelişkisi",
  PRICE_CONTRADICTION: "Fiyat çelişkisi",
  STALE_INVENTORY: "Eski stok bilgisi",
  HIGH_RISK_INTENT: "Hassas konu",
}

export function ReviewReasons({
  data,
  canManageStore,
}: {
  data: AiPerformance
  canManageStore: boolean
}) {
  const reasons = data.reviewReasons.slice(0, 5)
  const chartData = reasons.map((reason) => ({
    ...reason,
    label: shortLabels[reason.key] ?? "Ek kontrol",
  }))
  return (
    <section
      aria-labelledby="review-reasons-title"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="review-reasons-title" className="text-sm font-semibold">
          Neden kontrol gerekiyor?
        </h2>
        <span className="text-xs text-muted-foreground">
          {formatCount(data.draftDecisions.needsReview)} taslak
        </span>
      </header>
      {reasons.length ? (
        <div className="mt-5">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-56 w-full"
            aria-label="En sık inceleme nedenleri"
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={chartData}
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              barSize={14}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={98}
                tick={{ fontSize: 10 }}
              />
              <XAxis
                type="number"
                domain={[0, Math.max(data.draftDecisions.needsReview, 1)]}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={formatCount}
              />
              <ChartTooltip
                cursor={false}
                isAnimationActive={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      reviewReasonLabels[String(payload[0]?.payload?.key)] ??
                      "Ek kontrol gerekiyor"
                    }
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
          <ul className="sr-only">
            {reasons.map((reason) => (
              <li key={reason.key}>
                {reviewReasonLabels[reason.key] ?? "Ek kontrol"}:{" "}
                {formatCount(reason.count)} taslak
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-9 text-center">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            className="size-7 text-primary"
          />
          <p className="text-xs text-muted-foreground">
            Bu dönemde kaydedilmiş inceleme nedeni yok.
          </p>
        </div>
      )}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-64 text-[10px] leading-4 text-muted-foreground">
            Bir taslakta birden fazla neden bulunabilir.
          </p>
          {canManageStore ? (
            <Link
              href={APP_ROUTES.dashboard.automations.knowledge}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              Eksik bilgileri tamamla
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
