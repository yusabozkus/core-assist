import Link from "next/link"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  ChartLineData01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  CreditCardIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type { AdminAiUsage, AdminAiUsagePeriod } from "@/types/admin-ai-usage"

const PERIOD_OPTIONS: Array<{ value: AdminAiUsagePeriod; label: string }> = [
  { value: "7D", label: "7 gün" },
  { value: "30D", label: "30 gün" },
  { value: "90D", label: "90 gün" },
]
const numberFormatter = new Intl.NumberFormat("tr-TR")

export function AdminAiUsageDashboard({ data }: { data: AdminAiUsage }) {
  const { summary } = data
  const reviewRate = ratio(summary.needsReview, summary.totalDrafts)
  const autoSuccessRate = ratio(
    summary.autoSent,
    summary.autoSent + summary.autoFailed
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            AI operasyonu
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            AI ve kullanım
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Taslak kalitesi, otomasyon sonuçları ve çalışma alanı kotaları.
          </p>
        </div>
        <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-xs">
          {PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`${APP_ROUTES.admin.aiUsage}?period=${option.value}`}
              aria-current={data.period === option.value ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                data.period === option.value
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Üretilen taslak"
          value={formatNumber(summary.totalDrafts)}
          helper={`${formatNumber(summary.billedAiQuestions)} kota birimi · ${changeLabel(summary.draftChangePercentage)}`}
          icon={AiSparklesIcon}
        />
        <MetricCard
          label="Ortalama güven"
          value={formatPercent(summary.averageConfidence)}
          helper={`${formatNumber(summary.readyForSend)} taslak gönderime hazır`}
          icon={CheckmarkCircle01Icon}
        />
        <MetricCard
          label="Otomatik gönderim"
          value={formatNumber(summary.autoSent)}
          helper={`Başarı oranı %${autoSuccessRate}`}
          icon={ChartLineData01Icon}
        />
        <MetricCard
          label="İnceleme oranı"
          value={`%${reviewRate}`}
          helper={`${formatNumber(summary.needsReview)} taslak insan kontrolü istedi`}
          icon={AlertCircleIcon}
          tone={reviewRate >= 30 ? "warning" : "neutral"}
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Taslak karar dağılımı"
          description="AI tarafından verilen son kararların oranı"
        >
          <DecisionDistribution data={data} />
        </Panel>
        <Panel
          title="İşlem engelleri"
          description="Taslak üretimini veya otomasyonu durduran durumlar"
        >
          <div className="grid grid-cols-2 gap-px bg-border">
            <CompactMetric
              label="Üretim hatası"
              value={data.blockers.failed + summary.failedDrafts}
              icon={AlertCircleIcon}
              alert={data.blockers.failed + summary.failedDrafts > 0}
            />
            <CompactMetric
              label="Kota engeli"
              value={data.blockers.quota}
              icon={CreditCardIcon}
              alert={data.blockers.quota > 0}
            />
            <CompactMetric
              label="Abonelik engeli"
              value={data.blockers.subscription}
              icon={Clock01Icon}
              alert={data.blockers.subscription > 0}
            />
            <CompactMetric
              label="Eksik ürün bilgisi"
              value={data.blockers.missingInformation}
              icon={AiSparklesIcon}
              alert={data.blockers.missingInformation > 0}
            />
          </div>
        </Panel>
      </section>

      <section className="mt-5">
        <Panel
          title="Günlük taslak hacmi"
          description={`${formatDay(data.periodStart)} – ${formatDay(data.periodEnd)}`}
        >
          <DailyActivity data={data.daily} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Kota kullanımı"
          description="Aktif döneminde kotaya en yakın çalışma alanları"
          href={APP_ROUTES.admin.billing}
        >
          {data.quotaUsage.length ? (
            <div className="divide-y divide-border">
              {data.quotaUsage.map((workspace) => (
                <Link
                  key={workspace.workspaceId}
                  href={APP_ROUTES.admin.billingWorkspace(
                    workspace.workspaceId
                  )}
                  className="group block px-5 py-3.5 transition-colors hover:bg-muted/45"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {workspace.workspaceName}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {workspace.ownerEmail} · {planLabel(workspace.plan)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          workspace.utilization >= 90 && "text-destructive",
                          workspace.utilization >= 75 &&
                            workspace.utilization < 90 &&
                            "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {formatNumber(workspace.used)} /{" "}
                        {formatNumber(workspace.limit)}
                      </p>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-primary",
                        workspace.utilization >= 75 && "bg-amber-500",
                        workspace.utilization >= 90 && "bg-destructive"
                      )}
                      style={{ width: `${workspace.utilization}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="Aktif kullanım dönemi bulunmuyor." />
          )}
        </Panel>

        <Panel
          title="En yoğun mağazalar"
          description="Seçilen dönemde en fazla taslak üreten mağazalar"
        >
          {data.topStores.length ? (
            <div className="divide-y divide-border">
              {data.topStores.map((row, index) => (
                <div
                  key={row.store.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-xs font-semibold text-primary tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.store.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {row.store.workspace.name} · güven{" "}
                      {formatPercent(row.averageConfidence)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatNumber(row.drafts)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Bu dönemde taslak üretilmedi." />
          )}
        </Panel>
      </section>

      <section className="mt-5">
        <Panel
          title="Model kullanımı"
          description="Üretim hacmi ve model bazında ortalama güven"
        >
          {data.models.length ? (
            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
              {data.models.map((model) => (
                <div key={model.model} className="bg-card p-5">
                  <p className="truncate text-xs text-muted-foreground">
                    {model.model}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatNumber(model.drafts)}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {formatPercent(model.averageConfidence)} güven
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Model kullanım verisi bulunmuyor." />
          )}
        </Panel>
      </section>

      <p className="mt-5 text-right text-[11px] text-muted-foreground">
        Son güncelleme · {formatDate(data.generatedAt)}
      </p>
    </main>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  label: string
  value: string
  helper: string
  icon: IconSvgElement
  tone?: "neutral" | "warning"
}) {
  return (
    <div className="flex min-h-36 flex-col bg-card p-5">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          tone === "warning"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-primary/8 text-primary"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4.5" />
      </span>
      <div className="mt-auto pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums">
          {value}
        </p>
        <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
          {helper}
        </p>
      </div>
    </div>
  )
}

function Panel({
  title,
  description,
  href,
  children,
}: {
  title: string
  description: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Tümünü gör
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function DecisionDistribution({ data }: { data: AdminAiUsage }) {
  const { summary } = data
  const total = Math.max(summary.totalDrafts, 1)
  const segments = [
    {
      label: "Gönderime hazır",
      value: summary.readyForSend,
      className: "bg-emerald-500",
    },
    {
      label: "İnceleme gerekli",
      value: summary.needsReview,
      className: "bg-amber-500",
    },
    {
      label: "Yanıt verilmemeli",
      value: summary.doNotReply,
      className: "bg-muted-foreground/45",
    },
  ]
  return (
    <div className="p-5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) =>
          segment.value ? (
            <span
              key={segment.label}
              className={segment.className}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.label}>
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", segment.className)} />
              <p className="text-xs text-muted-foreground">{segment.label}</p>
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {formatNumber(segment.value)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              %{ratio(segment.value, summary.totalDrafts)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompactMetric({
  label,
  value,
  icon,
  alert,
}: {
  label: string
  value: number
  icon: IconSvgElement
  alert: boolean
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            alert
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/8 text-primary"
          )}
        >
          <HugeiconsIcon icon={icon} className="size-4" />
        </span>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            alert && "text-destructive"
          )}
        >
          {formatNumber(value)}
        </p>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function DailyActivity({ data }: { data: AdminAiUsage["daily"] }) {
  const maximum = Math.max(...data.map((point) => point.drafts), 1)
  return (
    <div className="overflow-x-auto px-5 pt-5 pb-4">
      <div
        className="flex h-48 min-w-[640px] items-end gap-1"
        aria-label="Günlük taslak grafiği"
      >
        {data.map((point) => (
          <div
            key={point.date}
            className="group flex h-full min-w-1 flex-1 items-end"
            title={`${formatDay(point.date)}: ${formatNumber(point.drafts)} taslak`}
          >
            <div
              className="w-full rounded-t-sm bg-primary/20 transition-colors group-hover:bg-primary"
              style={{
                height: `${Math.max(3, (point.drafts / maximum) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex min-w-[640px] justify-between text-[10px] text-muted-foreground">
        <span>{formatDay(data[0]?.date)}</span>
        <span>{formatDay(data.at(-1)?.date)}</span>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/8 text-primary">
        <HugeiconsIcon icon={Store01Icon} className="size-4" />
      </span>
      <p className="mt-3 text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `%${Math.round(value * 100)}`
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function changeLabel(value: number | null) {
  if (value === null) return "Önceki dönemde üretim yoktu"
  if (value === 0) return "Önceki dönemle aynı seviyede"
  return `Önceki döneme göre %${Math.abs(value)} ${value > 0 ? "artış" : "azalış"}`
}

function planLabel(plan: "STARTER" | "GROWTH" | "BUSINESS") {
  return plan.charAt(0) + plan.slice(1).toLocaleLowerCase("tr-TR")
}

function formatDay(value: string | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
