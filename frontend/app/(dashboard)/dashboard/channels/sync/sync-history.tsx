"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Clock01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { SyncHistoryRow } from "@/components/dashboard/channels/sync-history-row"
import { SyncProviderHealth } from "@/components/dashboard/channels/sync-provider-health"
import { SyncHistorySummary } from "@/components/dashboard/channels/sync-history-summary"
import { SyncRunDetailDialog } from "@/components/dashboard/channels/sync-run-detail-dialog"
import { SyncHistoryRowsSkeleton } from "@/components/skeletons/sync-history-skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import { getChannelSyncHistory, retryChannelSyncRun } from "@/lib/api/channels"
import { useListRequests } from "@/hooks/use-list-requests"
import type {
  SyncHistoryItem,
  SyncHistoryKindFilter,
  SyncHistoryOrder,
  SyncHistoryPage,
  SyncHistoryPeriod,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

const PAGE_SIZE = 20
const RUNNING_REFRESH_INTERVAL_MS = 4_000

type SyncHistoryFilters = {
  status: SyncHistoryStatusFilter
  kind: SyncHistoryKindFilter
  provider: string
  period: SyncHistoryPeriod
  order: SyncHistoryOrder
}

const STATUS_FILTERS: Array<{ value: SyncHistoryStatusFilter; label: string }> =
  [
    { value: "ALL", label: "Tüm durumlar" },
    { value: "COMPLETED", label: "Tamamlandı" },
    { value: "RUNNING", label: "Çalışıyor" },
    { value: "FAILED", label: "Başarısız" },
  ]

const KIND_FILTERS: Array<{ value: SyncHistoryKindFilter; label: string }> = [
  { value: "ALL", label: "Tüm işlemler" },
  { value: "FULL", label: "Ürün kataloğu" },
  { value: "INVENTORY", label: "Stok kontrolü" },
  { value: "QUESTION", label: "Soru kontrolü" },
]

const PERIOD_FILTERS: Array<{ value: SyncHistoryPeriod; label: string }> = [
  { value: "ALL", label: "Tüm zamanlar" },
  { value: "24H", label: "Son 24 saat" },
  { value: "7D", label: "Son 7 gün" },
  { value: "30D", label: "Son 30 gün" },
  { value: "90D", label: "Son 90 gün" },
]

const ORDER_FILTERS: Array<{ value: SyncHistoryOrder; label: string }> = [
  { value: "NEWEST", label: "En yeni önce" },
  { value: "OLDEST", label: "En eski önce" },
]

export function SyncHistory({
  storeId,
  storeName,
  initialPage,
  initialFilters,
}: {
  storeId: string
  storeName: string
  initialPage: SyncHistoryPage
  initialFilters: SyncHistoryFilters
}) {
  const [page, setPage] = useState(initialPage)
  const [status, setStatus] = useState(initialFilters.status)
  const [kind, setKind] = useState(initialFilters.kind)
  const [provider, setProvider] = useState(initialFilters.provider)
  const [period, setPeriod] = useState(initialFilters.period)
  const [order, setOrder] = useState(initialFilters.order)
  const [selectedRun, setSelectedRun] = useState<SyncHistoryItem | null>(null)
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listKey = JSON.stringify([
    storeId,
    status,
    kind,
    provider,
    period,
    order,
  ])
  const requests = useListRequests(
    listKey,
    JSON.stringify([
      storeId,
      initialFilters.status,
      initialFilters.kind,
      initialFilters.provider,
      initialFilters.period,
      initialFilters.order,
    ])
  )
  const loadMoreTargetRef = useRef<HTMLDivElement | null>(null)

  const loadFirstPage = useCallback(
    async (quiet = false) => {
      const request = requests.begin(listKey, quiet ? "refresh" : "first")
      if (!request) return
      if (!quiet) setIsLoading(true)
      setError(null)

      try {
        const result = await getChannelSyncHistory(storeId, {
          status,
          kind,
          provider,
          order,
          from: getPeriodStart(period),
          limit: PAGE_SIZE,
          signal: request.signal,
        })

        if (!requests.commit(request)) return
        setPage(result)
        setSelectedRun((current) =>
          current
            ? (result.items.find((item) => item.id === current.id) ?? current)
            : null
        )
      } catch (caughtError) {
        if (!requests.isCurrent(request)) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Senkron geçmişi alınamadı."
        )
      } finally {
        if (requests.finish(request) && !quiet) {
          setIsLoading(false)
        }
      }
    },
    [kind, listKey, requests, order, period, provider, status, storeId]
  )

  const loadMore = useCallback(async () => {
    if (!page.nextCursor || isLoadingMore || isLoading) return
    const request = requests.begin(listKey, "more")
    if (!request) return

    setIsLoadingMore(true)
    setError(null)
    try {
      const result = await getChannelSyncHistory(storeId, {
        cursor: page.nextCursor,
        status,
        kind,
        provider,
        order,
        from: getPeriodStart(period),
        limit: PAGE_SIZE,
        signal: request.signal,
      })
      if (!requests.isCurrent(request)) return
      setPage((current) => ({
        ...result,
        items: mergeHistoryItems(current.items, result.items),
      }))
    } catch (caughtError) {
      if (!requests.isCurrent(request)) return
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer kayıtlar yüklenemedi."
      )
    } finally {
      if (requests.finish(request)) setIsLoadingMore(false)
    }
  }, [
    isLoading,
    isLoadingMore,
    kind,
    listKey,
    requests,
    order,
    page.nextCursor,
    period,
    provider,
    status,
    storeId,
  ])

  useEffect(() => {
    writeFiltersToUrl({ status, kind, provider, period, order })

    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      setIsLoadingMore(false)
      setError(null)
      setIsLoading(false)
      if (!requests.isReady(listKey)) void loadFirstPage()
    })
    return () => {
      disposed = true
    }
  }, [kind, listKey, requests, loadFirstPage, order, period, provider, status])

  useEffect(() => {
    if (page.summary.running === 0) return

    const interval = window.setInterval(() => {
      void loadFirstPage(true)
    }, RUNNING_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadFirstPage, page.summary.running])

  useEffect(() => {
    const target = loadMoreTargetRef.current
    if (!target || !page.nextCursor || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: "240px 0px" }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [isLoading, loadMore, page.nextCursor])

  async function retryRun(run: SyncHistoryItem) {
    if (retryingRunId) return

    setRetryingRunId(run.id)
    setError(null)
    try {
      await retryChannelSyncRun(storeId, run.id)
      setSelectedRun(null)
      await loadFirstPage(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Senkronizasyon yeniden başlatılamadı."
      )
    } finally {
      setRetryingRunId(null)
    }
  }

  function resetFilters() {
    setStatus("ALL")
    setKind("ALL")
    setProvider("ALL")
    setPeriod("ALL")
    setOrder("NEWEST")
  }

  const hasFilters =
    status !== "ALL" ||
    kind !== "ALL" ||
    provider !== "ALL" ||
    period !== "ALL" ||
    order !== "NEWEST"
  const hasAnyHistory = initialPage.providers.length > 0

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-start justify-between gap-3 sm:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Senkron Geçmişi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasındaki katalog, stok ve soru akışlarını; güncel
            ilerleme, değişiklikler ve hatalarla birlikte takip edin.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="size-9 shrink-0 bg-card p-0 sm:w-auto sm:px-3"
          aria-label="Senkron geçmişini yenile"
          onClick={() => void loadFirstPage()}
          disabled={isLoading}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Yenile</span>
        </Button>
      </div>

      <div className="mt-6">
        <SyncHistorySummary summary={page.summary} />
      </div>

      <SyncProviderHealth providers={page.providerHealth} />

      {!hasAnyHistory ? (
        <EmptyHistory />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 lg:hidden">
            <NativeFilterSelect
              label="Durum"
              value={status}
              onValueChange={(value) =>
                setStatus(value as SyncHistoryStatusFilter)
              }
              items={STATUS_FILTERS}
            />
            <NativeFilterSelect
              label="İşlem"
              value={kind}
              onValueChange={(value) => setKind(value as SyncHistoryKindFilter)}
              items={KIND_FILTERS}
            />
            <NativeFilterSelect
              label="Kanal"
              value={provider}
              onValueChange={setProvider}
              items={[
                { value: "ALL", label: "Tüm kanallar" },
                ...initialPage.providers.map((providerKey) => ({
                  value: providerKey,
                  label: getProviderName(providerKey),
                })),
              ]}
            />
            <NativeFilterSelect
              label="Dönem"
              value={period}
              onValueChange={(value) => setPeriod(value as SyncHistoryPeriod)}
              items={PERIOD_FILTERS}
            />
            <NativeFilterSelect
              label="Sıralama"
              value={order}
              onValueChange={(value) => setOrder(value as SyncHistoryOrder)}
              items={ORDER_FILTERS}
            />
            <span className="self-end pb-2 text-right text-xs text-muted-foreground tabular-nums">
              {page.items.length.toLocaleString("tr-TR")} /{" "}
              {page.total.toLocaleString("tr-TR")} kayıt
            </span>
          </div>

          <div className="mt-6 hidden flex-wrap items-center gap-2 lg:flex">
            <FilterSelect
              value={status}
              onValueChange={(value) =>
                setStatus(value as SyncHistoryStatusFilter)
              }
              items={STATUS_FILTERS}
            />
            <FilterSelect
              value={kind}
              onValueChange={(value) => setKind(value as SyncHistoryKindFilter)}
              items={KIND_FILTERS}
            />

            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="border-border bg-card">
                <SelectValue placeholder="Tüm kanallar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm kanallar</SelectItem>
                {initialPage.providers.map((providerKey) => (
                  <SelectItem key={providerKey} value={providerKey}>
                    {getProviderName(providerKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <FilterSelect
              value={period}
              onValueChange={(value) => setPeriod(value as SyncHistoryPeriod)}
              items={PERIOD_FILTERS}
            />

            <Select
              value={order}
              onValueChange={(value) => setOrder(value as SyncHistoryOrder)}
            >
              <SelectTrigger className="border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEWEST">En yeni önce</SelectItem>
                <SelectItem value="OLDEST">En eski önce</SelectItem>
              </SelectContent>
            </Select>

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {page.items.length.toLocaleString("tr-TR")} /{" "}
              {page.total.toLocaleString("tr-TR")} kayıt
            </span>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <SyncHistoryRowsSkeleton />
            ) : page.items.length === 0 ? (
              <NoHistoryResults onReset={resetFilters} />
            ) : (
              <div className="grid gap-3 lg:block lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-xs">
                <div className="hidden grid-cols-[minmax(11rem,1.1fr)_minmax(9rem,0.75fr)_minmax(12rem,1.1fr)_minmax(10rem,0.85fr)_5rem_7rem] gap-3 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:grid">
                  <span>İşlem</span>
                  <span>Kanal</span>
                  <span>Sonuç</span>
                  <span>Başlangıç</span>
                  <span>Süre</span>
                  <span>Durum</span>
                </div>
                {page.items.map((run) => (
                  <SyncHistoryRow
                    key={run.id}
                    run={run}
                    onSelect={() => setSelectedRun(run)}
                    onRetry={() => void retryRun(run)}
                    isRetrying={retryingRunId === run.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            ref={loadMoreTargetRef}
            className="flex min-h-20 flex-col items-center justify-center gap-2"
          >
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {isLoadingMore ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-3.5 animate-spin"
                />
                Diğer kayıtlar yükleniyor...
              </span>
            ) : !page.nextCursor && page.items.length > 0 && !error ? (
              <span className="text-xs text-muted-foreground">
                Tüm senkronizasyon kayıtları gösteriliyor
              </span>
            ) : null}
          </div>
        </>
      )}

      {hasFilters && error && page.items.length === 0 ? (
        <Button type="button" variant="link" size="sm" onClick={resetFilters}>
          Filtreleri temizle
        </Button>
      ) : null}

      <SyncRunDetailDialog
        run={selectedRun}
        open={Boolean(selectedRun)}
        onOpenChange={(open) => {
          if (!open) setSelectedRun(null)
        }}
        onRetry={
          selectedRun?.status === "FAILED"
            ? () => void retryRun(selectedRun)
            : undefined
        }
        isRetrying={selectedRun ? retryingRunId === selectedRun.id : false}
      />
    </div>
  )
}

function FilterSelect({
  value,
  onValueChange,
  items,
}: {
  value: string
  onValueChange: (value: string) => void
  items: Array<{ value: string; label: string }>
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="border-border bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function NativeFilterSelect({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  items: Array<{ value: string; label: string }>
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function EmptyHistory() {
  return (
    <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={Clock01Icon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">
        Henüz senkronizasyon kaydı yok
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Bir satış kanalından ürün, stok veya soru senkronizasyonu
        başlattığınızda işlemin sonucu burada görünecek.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={APP_ROUTES.dashboard.channels.root}>
          Satış kanallarına git
        </Link>
      </Button>
    </div>
  )
}

function NoHistoryResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <HugeiconsIcon icon={Clock01Icon} className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold text-foreground">
        Eşleşen kayıt bulunamadı
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Seçili kanal, işlem, tarih veya durum filtrelerini değiştirin.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={onReset}
      >
        Filtreleri temizle
      </Button>
    </div>
  )
}

function writeFiltersToUrl(filters: SyncHistoryFilters) {
  const searchParams = new URLSearchParams(window.location.search)
  setOptionalParam(searchParams, "status", filters.status, "ALL")
  setOptionalParam(searchParams, "kind", filters.kind, "ALL")
  setOptionalParam(searchParams, "provider", filters.provider, "ALL")
  setOptionalParam(searchParams, "period", filters.period, "ALL")
  setOptionalParam(searchParams, "order", filters.order, "NEWEST")

  const query = searchParams.toString()
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`
  )
}

function setOptionalParam(
  searchParams: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string
) {
  if (value === defaultValue) searchParams.delete(key)
  else searchParams.set(key, value)
}

function getPeriodStart(period: SyncHistoryPeriod) {
  if (period === "ALL") return undefined

  const durations: Record<Exclude<SyncHistoryPeriod, "ALL">, number> = {
    "24H": 24 * 60 * 60 * 1_000,
    "7D": 7 * 24 * 60 * 60 * 1_000,
    "30D": 30 * 24 * 60 * 60 * 1_000,
    "90D": 90 * 24 * 60 * 60 * 1_000,
  }

  return new Date(Date.now() - durations[period]).toISOString()
}

function mergeHistoryItems(
  current: SyncHistoryItem[],
  incoming: SyncHistoryItem[]
) {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item])
    ).values(),
  ]
}
