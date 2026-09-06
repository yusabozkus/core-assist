"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AiSparklesIcon,
  AlertCircleIcon,
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
import { cn } from "@/lib/utils"
import type { AiPerformance, AiPerformanceRange } from "@/types/ai-performance"
import type { StoreSummary } from "@/types/store"

const ranges: Array<{ value: AiPerformanceRange; label: string }> = [
  { value: "7D", label: "7 gün" },
  { value: "30D", label: "30 gün" },
  { value: "90D", label: "90 gün" },
  { value: "ALL", label: "Tüm zamanlar" },
]

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
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", next.range ?? range)
    const nextProvider = next.provider ?? provider
    if (nextProvider === "ALL") params.delete("provider")
    else params.set("provider", nextProvider)
    startTransition(() =>
      router.replace(`${pathname}?${params}`, { scroll: false })
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {activeStore.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Performansı
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Yanıtların kalitesini, kullanıcı onaylarını ve otomasyonun katkısını
            izleyin.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-9 bg-card"
                aria-label="Performans verilerini güncelle"
                disabled={pending}
                onClick={() => startTransition(() => router.refresh())}
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
          <Button asChild size="sm" variant="outline" className="bg-card">
            <Link href={APP_ROUTES.dashboard.automations.root}>
              <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
              Yanıt ayarları
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-3">
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
        {performance && (
          <p className="text-[10px] text-muted-foreground">
            {performance.from
              ? `${dateFormatter.format(new Date(performance.from))} – ${dateFormatter.format(new Date(performance.generatedAt))}`
              : "Tüm kayıtlar"}{" "}
            · {performance.timezone}
          </p>
        )}
      </div>

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
            onClick={() => startTransition(() => router.refresh())}
          >
            Tekrar dene
          </Button>
        </section>
      ) : hasActivity ? (
        <div
          aria-busy={pending}
          className={cn(
            "space-y-5",
            pending && "pointer-events-none opacity-60"
          )}
        >
          <AnalyticsSummary data={performance} />
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
            <AiActivityChart
              trend={performance.trend}
              granularity={performance.trendGranularity}
            />
            <DraftOutcomes data={performance} />
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            <AutomationImpact data={performance} />
            <ReviewReasons data={performance} />
          </div>
          <IntentAnalysis intents={performance.intents} />
          <ProviderComparison providers={performance.providers} />
          <AiActivityList
            activity={performance.recentActivity}
            timezone={performance.timezone}
          />
          <footer className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] leading-5 text-muted-foreground">
            <span>
              Taslaklar oluşturulma, yanıtlar gönderilme tarihine göre
              hesaplanır.
            </span>
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
    </div>
  )
}
