"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Clock01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { SyncHistoryRow } from "@/components/dashboard/channels/sync-history-row"
import { SyncHistorySummary } from "@/components/dashboard/channels/sync-history-summary"
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
import { getChannelSyncHistory } from "@/lib/api/channels"
import type {
  SyncHistoryItem,
  SyncHistoryKindFilter,
  SyncHistoryPage,
  SyncHistoryStatusFilter,
} from "@/types/sync-history"

const PAGE_SIZE = 20
const RUNNING_REFRESH_INTERVAL_MS = 4_000

const STATUS_FILTERS: Array<{
  value: SyncHistoryStatusFilter
  label: string
}> = [
  { value: "ALL", label: "Tüm durumlar" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "RUNNING", label: "Çalışıyor" },
  { value: "FAILED", label: "Başarısız" },
]

const KIND_FILTERS: Array<{
  value: SyncHistoryKindFilter
  label: string
}> = [
  { value: "ALL", label: "Tüm işlemler" },
  { value: "FULL", label: "Ürün kataloğu" },
  { value: "INVENTORY", label: "Stok kontrolü" },
  { value: "QUESTION", label: "Soru kontrolü" },
]

export function SyncHistory({
  storeId,
  storeName,
  initialPage,
}: {
  storeId: string
  storeName: string
  initialPage: SyncHistoryPage
}) {
  const [page, setPage] = useState(initialPage)
  const [status, setStatus] = useState<SyncHistoryStatusFilter>("ALL")
  const [kind, setKind] = useState<SyncHistoryKindFilter>("ALL")
  const [provider, setProvider] = useState("ALL")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitialRender = useRef(true)
  const requestSequence = useRef(0)

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal, quiet = false) => {
      const requestId = ++requestSequence.current
      if (!quiet) setIsLoading(true)
      setError(null)

      try {
        const result = await getChannelSyncHistory(storeId, {
          status,
          kind,
          provider,
          limit: PAGE_SIZE,
          signal,
        })

        if (requestId !== requestSequence.current) return
        setPage(result)
      } catch (caughtError) {
        if (signal?.aborted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Senkron geçmişi alınamadı."
        )
      } finally {
        if (requestId === requestSequence.current && !quiet) {
          setIsLoading(false)
        }
      }
    },
    [kind, provider, status, storeId]
  )

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    const controller = new AbortController()
    void loadFirstPage(controller.signal)
    return () => controller.abort()
  }, [loadFirstPage])

  useEffect(() => {
    if (page.summary.running === 0) return

    const interval = window.setInterval(() => {
      void loadFirstPage(undefined, true)
    }, RUNNING_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadFirstPage, page.summary.running])

  async function loadMore() {
    if (!page.nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const result = await getChannelSyncHistory(storeId, {
        cursor: page.nextCursor,
        status,
        kind,
        provider,
        limit: PAGE_SIZE,
      })
      setPage((current) => ({
        ...result,
        items: mergeHistoryItems(current.items, result.items),
      }))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer kayıtlar yüklenemedi."
      )
    } finally {
      setIsLoadingMore(false)
    }
  }

  function resetFilters() {
    setStatus("ALL")
    setKind("ALL")
    setProvider("ALL")
  }

  const hasFilters = status !== "ALL" || kind !== "ALL" || provider !== "ALL"

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Senkron Geçmişi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasının ürün, stok ve soru senkronizasyonlarını,
            işlenen kayıtları ve oluşan hataları takip edin.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void loadFirstPage()}
          disabled={isLoading}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Yenile
        </Button>
      </div>

      <div className="mt-6">
        <SyncHistorySummary summary={page.summary} />
      </div>

      {initialPage.summary.total === 0 ? (
        <EmptyHistory />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as SyncHistoryStatusFilter)
              }
            >
              <SelectTrigger className="rounded-xl border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={kind}
              onValueChange={(value) => setKind(value as SyncHistoryKindFilter)}
            >
              <SelectTrigger className="rounded-xl border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {KIND_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="rounded-xl border-border bg-card">
                <SelectValue placeholder="Tüm kanallar" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="ALL">Tüm kanallar</SelectItem>
                {initialPage.providers.map((providerKey) => (
                  <SelectItem key={providerKey} value={providerKey}>
                    {getProviderName(providerKey)}
                  </SelectItem>
                ))}
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
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="hidden grid-cols-[minmax(11rem,1.1fr)_minmax(9rem,0.75fr)_minmax(11rem,1fr)_minmax(10rem,0.85fr)_5rem_7rem] gap-3 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:grid">
                  <span>İşlem</span>
                  <span>Kanal</span>
                  <span>Sonuç</span>
                  <span>Başlangıç</span>
                  <span>Süre</span>
                  <span>Durum</span>
                </div>
                {page.items.map((run) => (
                  <SyncHistoryRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-20 flex-col items-center justify-center gap-2">
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {page.nextCursor && !isLoading ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    className="size-3.5 animate-spin"
                  />
                ) : null}
                {isLoadingMore ? "Yükleniyor..." : "Daha fazla göster"}
              </Button>
            ) : page.items.length > 0 && !error ? (
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
    </div>
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
        Seçili kanal, işlem veya durum filtrelerini değiştirin.
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
