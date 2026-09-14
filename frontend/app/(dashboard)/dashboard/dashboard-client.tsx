"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductDetailDialog } from "@/components/dashboard/catalog/products/product-detail-dialog"
import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import { DashboardMetrics } from "@/components/dashboard/overview/dashboard-metrics"
import { QuestionVolumeChart } from "@/components/dashboard/overview/question-volume-chart"
import { DashboardQueue } from "@/components/dashboard/overview/dashboard-queue"
import { PriorityQuestions } from "@/components/dashboard/overview/priority-questions"
import { DashboardChannels } from "@/components/dashboard/overview/dashboard-channels"
import {
  CatalogHealth,
  DashboardCatalog,
} from "@/components/dashboard/overview/dashboard-catalog"
import { DashboardShortcuts } from "@/components/dashboard/overview/dashboard-shortcuts"
import { DashboardPlanUsage } from "@/components/dashboard/overview/dashboard-plan-usage"
import { DashboardOverviewSkeleton } from "@/components/skeletons/dashboard-overview-skeleton"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APP_ROUTES } from "@/constants/site"
import { getDashboardOverview } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import type { DashboardOverview, DashboardRange } from "@/types/dashboard"

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-l-2 border-primary/50 pl-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

export function DashboardClient({
  storeId,
  storeName,
  range,
  initialData,
}: {
  storeId: string
  storeName: string
  range: DashboardRange
  initialData: DashboardOverview | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(
    initialData
      ? null
      : "Genel bakış verileri alınamadı. Lütfen tekrar deneyin."
  )
  const [refreshing, setRefreshing] = useState(false)
  const [isChangingRange, startRangeTransition] = useTransition()
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  )
  const requestRef = useRef<AbortController | null>(null)
  const { refresh: refreshBillingUsage } = useBillingUsage()

  const refresh = useCallback(async () => {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setRefreshing(true)
    try {
      const result = await getDashboardOverview(
        storeId,
        range,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
      )
      if (controller.signal.aborted) return
      setData(result)
      setError(null)
      void refreshBillingUsage()
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Veriler güncellenemedi. Bağlantınızı kontrol edip tekrar deneyin."
        )
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setRefreshing(false)
    }
  }, [storeId, range, refreshBillingUsage])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 30_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [refresh])

  function changeRange(nextRange: DashboardRange) {
    if (nextRange === range) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", nextRange)
    startRangeTransition(() =>
      router.replace(`${pathname}?${params}`, { scroll: false })
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {storeName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Genel bakış</h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Sorularınız, bekleyen işleriniz ve mağazanızın güncel durumu.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-9 bg-card"
                onClick={() => void refresh()}
                disabled={refreshing || isChangingRange}
                aria-label="Genel bakışı güncelle"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={cn(
                    "size-4",
                    (refreshing || isChangingRange) &&
                      "motion-safe:animate-spin"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Genel bakışı güncelle</TooltipContent>
          </Tooltip>
          <Button asChild size="sm" className="ml-auto sm:ml-1">
            <Link href={APP_ROUTES.dashboard.inbox}>
              Gelen kutusu
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card p-1"
          role="group"
          aria-label="İstatistik dönemi"
        >
          {(["7D", "30D"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              disabled={isChangingRange}
              onClick={() => changeRange(value)}
              className={cn(
                "h-7 rounded-md px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                range === value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {value === "7D" ? "Son 7 gün" : "Son 30 gün"}
            </button>
          ))}
        </div>
        {data ? (
          <p className="text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat("tr-TR", {
              day: "numeric",
              month: "short",
              timeZone: data.period.timezone,
            }).format(new Date(data.period.from))}{" "}
            –{" "}
            {new Intl.DateTimeFormat("tr-TR", {
              day: "numeric",
              month: "short",
              timeZone: data.period.timezone,
            }).format(new Date(data.period.to))}{" "}
            · Yerel saat
          </p>
        ) : null}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs"
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="min-w-0 flex-1 leading-5">
            {error}
            {data ? " Son alınan bilgiler gösteriliyor." : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            Tekrar dene
          </Button>
        </div>
      )}

      {data ? (
        <div
          className={cn(
            "space-y-8 transition-opacity",
            isChangingRange && "opacity-50"
          )}
          aria-busy={isChangingRange || refreshing}
        >
          <DashboardPlanUsage />
          <section className="space-y-4">
            <SectionHeading
              title="Operasyon özeti"
              description="Gelen soru hacmini, yanıtlananları ve şu anda müdahale gerektiren işleri birlikte görün."
            />
            <DashboardMetrics data={data} />
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading
              title="Soru operasyonu"
              description="Gelen ve yanıtlanan soruların zaman içindeki akışını, mevcut iş kuyruğuyla birlikte değerlendirin."
            />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
              <QuestionVolumeChart data={data} />
              <DashboardQueue data={data} />
            </div>
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading
              title="Öncelikli işler"
              description="İnsan kontrolü bekleyen soruları, satış kanallarının durumunu ve katalog uyarılarını tek alanda takip edin."
            />
            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
              <PriorityQuestions data={data} />
              <div className="grid min-w-0 gap-5">
                <DashboardChannels data={data} />
                <CatalogHealth data={data} />
              </div>
            </div>
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading
              title="Katalog görünümü"
              description={`Son ${data.period.days} günde en çok müşteri ilgisi alan ürünleri inceleyin.`}
            />
            <DashboardCatalog
              data={data}
              onSelectProduct={setSelectedProductId}
            />
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <SectionHeading
              title="Hızlı erişim"
              description="Sık kullandığınız yönetim ve analiz ekranlarına doğrudan geçin."
            />
            <DashboardShortcuts />
          </section>
          <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>
              Son güncelleme:{" "}
              {new Date(data.generatedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: data.period.timezone,
              })}{" "}
              · {data.period.timezone}
            </span>
            <span>Bu ekran açıkken 30 saniyede bir yenilenir.</span>
          </footer>
        </div>
      ) : refreshing ? (
        <DashboardOverviewSkeleton contentOnly />
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="size-7 text-muted-foreground"
          />
          <p className="text-sm font-medium">
            Mağaza özeti şu anda görüntülenemiyor
          </p>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            Verileriniz silinmedi. Tekrar deneyebilir veya gelen kutusundan
            devam edebilirsiniz.
          </p>
        </div>
      )}

      <ProductDetailDialog
        storeId={storeId}
        productId={selectedProductId}
        open={selectedProductId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProductId(null)
        }}
      />
    </div>
  )
}
