"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  RefreshIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { AiActivityChart } from "@/components/dashboard/analytics/ai-activity-chart"
import { AnalyticsSummary } from "@/components/dashboard/analytics/analytics-summary"
import { DraftOutcomes } from "@/components/dashboard/analytics/draft-outcomes"
import { AutomationImpact } from "@/components/dashboard/analytics/automation-impact"
import { ReviewReasons } from "@/components/dashboard/analytics/review-reasons"
import { IntentAnalysis } from "@/components/dashboard/analytics/intent-analysis"
import { ProviderComparison } from "@/components/dashboard/analytics/provider-comparison"
import { AiActivityList } from "@/components/dashboard/analytics/ai-activity-list"
import { PerformanceOverview } from "@/components/dashboard/analytics/performance-overview"
import { CurrentReviewWorkload } from "@/components/dashboard/analytics/current-review-workload"
import { PerformanceQuestionSheet } from "@/components/dashboard/analytics/performance-question-sheet"
import { AiQuotaIndicator } from "@/components/dashboard/analytics/ai-quota-indicator"
import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APP_ROUTES } from "@/constants/site"
import { canManageStore } from "@/lib/dashboard-access"
import { cn } from "@/lib/utils"
import type {
  AiPerformance,
  AiPerformanceRange,
  AiPerformanceSelection,
  AiPerformanceDetailScope,
} from "@/types/ai-performance"
import type { StoreSummary } from "@/types/store"

const ranges: Array<{ value: AiPerformanceRange; label: string }> = [
  { value: "7D", label: "7 gün" },
  { value: "30D", label: "30 gün" },
  { value: "90D", label: "90 gün" },
  { value: "ALL", label: "Tüm zamanlar" },
]

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="border-l-2 border-primary/50 pl-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

export function AnalyticsClient({
  activeStore,
  performance,
  range,
  provider,
}: {
  activeStore: StoreSummary
  performance: AiPerformance | null
  range: AiPerformanceRange
  provider: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [detailScope, setDetailScope] = useState<
    (AiPerformanceDetailScope & { storeId: string }) | null
  >(null)
  const { refresh: refreshBillingUsage } = useBillingUsage()
  const mayManageStore = canManageStore(activeStore.accessLevel)
  const providers = [
    ...new Set([
      ...(performance?.availableProviders ?? []),
      ...(provider !== "ALL" ? [provider] : []),
    ]),
  ]
  const hasActivity =
    performance &&
    (performance.summary.totalDrafts > 0 ||
      performance.answers.totalSent > 0 ||
      performance.delivery.failed > 0 ||
      performance.delivery.queued > 0 ||
      performance.delivery.processing > 0)
  const hasPreviousActivity =
    performance?.comparison &&
    (performance.comparison.totalDrafts > 0 ||
      performance.comparison.aiAssisted > 0)
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: range === "ALL" ? "numeric" : undefined,
    timeZone: performance?.timezone ?? "Europe/Istanbul",
  })

  function changeFilters(next: {
    range?: AiPerformanceRange
    provider?: string
  }) {
    setDetailScope(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", next.range ?? range)
    const nextProvider = next.provider ?? provider
    if (nextProvider === "ALL") params.delete("provider")
    else params.set("provider", nextProvider)
    startTransition(() =>
      router.replace(`${pathname}?${params}`, { scroll: false })
    )
  }

  function refreshPerformance() {
    setDetailScope(null)
    void refreshBillingUsage()
    startTransition(() => router.refresh())
  }

  function inspectQuestions(selection: AiPerformanceSelection) {
    if (!performance || pending) return
    setDetailScope({
      ...selection,
      storeId: activeStore.id,
      range: performance.range,
      provider: performance.provider,
      asOf: performance.generatedAt,
      from: performance.from,
      timezone: performance.timezone,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {activeStore.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Performansı
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            AI yanıtlarının ne kadar kullanıldığını, nerede insan kontrolü
            gerektiğini ve otomasyonun sonucunu görün.
          </p>
        </div>
        <div
          className={cn(
            "grid gap-2 sm:flex sm:shrink-0 sm:items-center",
            mayManageStore
              ? "grid-cols-[minmax(0,1fr)_2.5rem]"
              : "grid-cols-[2.5rem]"
          )}
        >
          {mayManageStore ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-10 w-full bg-card sm:h-9 sm:w-auto"
            >
              <Link href={APP_ROUTES.dashboard.automations.root}>
                <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                Yanıt ayarları
              </Link>
            </Button>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-10 bg-card sm:size-9"
                aria-label="Performans verilerini güncelle"
                disabled={pending}
                onClick={refreshPerformance}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={cn(
                    "size-4",
                    pending && "motion-safe:animate-spin"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Verileri güncelle</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="space-y-3 border-b border-border pb-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <label className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Dönem
            </span>
            <span className="relative mt-1 block">
              <select
                value={range}
                disabled={pending}
                onChange={(event) =>
                  changeFilters({
                    range: event.target.value as AiPerformanceRange,
                  })
                }
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-border bg-card py-2 pr-8 pl-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {ranges.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
          <label className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Pazaryeri
            </span>
            <span className="relative mt-1 block">
              <select
                value={provider}
                disabled={pending}
                onChange={(event) =>
                  changeFilters({ provider: event.target.value })
                }
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-border bg-card py-2 pr-8 pl-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="ALL">Tüm pazaryerleri</option>
                {providers.map((key) => (
                  <option key={key} value={key}>
                    {getProviderName(key)}
                  </option>
                ))}
              </select>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
        </div>
        <div className="hidden flex-wrap items-center gap-3 sm:flex">
          <div
            role="group"
            aria-label="Performans dönemi"
            className="inline-flex items-center rounded-lg border border-border bg-card p-1"
          >
            {ranges.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                disabled={pending}
                onClick={() => changeFilters({ range: option.value })}
                className={cn(
                  "h-7 rounded-md px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  range === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Select
            value={provider}
            disabled={pending}
            onValueChange={(value) => changeFilters({ provider: value })}
          >
            <SelectTrigger
              aria-label="Pazaryeri filtresi"
              className="min-w-44 rounded-lg border-border bg-card text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm pazaryerleri</SelectItem>
              {providers.map((key) => (
                <SelectItem key={key} value={key}>
                  <ProviderLogo
                    provider={key}
                    className="size-5 rounded"
                    sizes="20px"
                  />
                  {getProviderName(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {performance ? (
          <p className="text-[11px] leading-5 text-muted-foreground sm:ml-auto">
            {performance.from
              ? `${dateFormatter.format(new Date(performance.from))} – ${dateFormatter.format(new Date(performance.generatedAt))}`
              : "Tüm kayıtlar"}{" "}
            · <span title={performance.timezone}>Yerel saat</span>
          </p>
        ) : null}
      </div>

      {performance ? (
        <CurrentReviewWorkload
          count={performance.currentWorkload.needsReview}
        />
      ) : null}

      {!performance ? (
        <section
          role="alert"
          className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-10 text-center"
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="size-7 text-muted-foreground"
          />
          <h2 className="mt-4 text-sm font-semibold">
            Performans verileri alınamadı
          </h2>
          <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
            Bağlantıyı kontrol edip tekrar deneyin. Seçtiğiniz dönem ve
            pazaryeri korunur.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5"
            disabled={pending}
            onClick={refreshPerformance}
          >
            Tekrar dene
          </Button>
        </section>
      ) : hasActivity || hasPreviousActivity ? (
        <div
          aria-busy={pending}
          className={cn(
            "space-y-8",
            pending && "pointer-events-none opacity-60"
          )}
        >
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.8fr)]">
            <PerformanceOverview
              data={performance}
              onInspectFailed={() =>
                inspectQuestions({ kind: "FAILED_DELIVERY" })
              }
            />
            <AiQuotaIndicator className="h-full" />
          </div>
          <section className="space-y-3 sm:space-y-4">
            <SectionHeading title="Öne çıkan metrikler" />
            {performance.comparison && (
              <p className="text-[11px] leading-5 text-muted-foreground">
                Önceki dönem:{" "}
                {dateFormatter.format(new Date(performance.comparison.from))} –{" "}
                {dateFormatter.format(new Date(performance.comparison.to))}. Her
                iki dönem aynı yerel saate kadar karşılaştırılır.
              </p>
            )}
            <AnalyticsSummary data={performance} />
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading title="Taslak akışı" />
            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
              <AiActivityChart
                trend={performance.trend}
                granularity={performance.trendGranularity}
              />
              <DraftOutcomes data={performance} />
            </div>
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading title="Otomasyon ve insan kontrolü" />
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <AutomationImpact
                data={performance}
                canManageStore={mayManageStore}
                onInspectFailed={() =>
                  inspectQuestions({ kind: "FAILED_DELIVERY" })
                }
              />
              <ReviewReasons
                data={performance}
                onInspect={(reason) =>
                  inspectQuestions({ kind: "REVIEW_REASON", reason })
                }
              />
            </div>
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading title="Kanal ve soru türü analizi" />
            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)]">
              <ProviderComparison providers={performance.providers} />
              <IntentAnalysis intents={performance.intents} />
            </div>
          </section>
          <AiActivityList
            activity={performance.recentActivity}
            timezone={performance.timezone}
          />
          <footer className="pt-1 text-right text-[10px] leading-5 text-muted-foreground">
            <span>
              Son güncelleme{" "}
              {new Date(performance.generatedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: performance.timezone,
              })}
            </span>
          </footer>
        </div>
      ) : (
        <section className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={AiSparklesIcon} className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            Bu seçimde henüz performans verisi yok
          </h2>
          <p className="mt-2 max-w-md text-xs leading-6 text-muted-foreground">
            Gelen kutusunda ilk AI taslağınızı oluşturun. Yanıtlar onaylanıp
            gönderildikçe kalite ve otomasyon sonuçları burada görünür.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href={APP_ROUTES.dashboard.inbox}>
                Gelen kutusunu aç
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
            </Button>
            {(range !== "ALL" || provider !== "ALL") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => changeFilters({ range: "ALL", provider: "ALL" })}
              >
                Tüm kayıtları göster
              </Button>
            )}
          </div>
        </section>
      )}
      {detailScope &&
        detailScope.storeId === activeStore.id &&
        detailScope.asOf === performance?.generatedAt && (
          <PerformanceQuestionSheet
            key={`${activeStore.id}:${detailScope.asOf}:${detailScope.kind}:${detailScope.kind === "REVIEW_REASON" ? detailScope.reason : ""}`}
            storeId={activeStore.id}
            scope={detailScope}
            onClose={() => setDetailScope(null)}
          />
        )}
    </div>
  )
}
