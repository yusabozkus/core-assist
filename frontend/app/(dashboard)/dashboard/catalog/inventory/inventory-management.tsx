"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowUpDownIcon,
  Clock01Icon,
  Package01Icon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  InventoryProductRow,
  type InventoryProductGroup,
} from "@/components/dashboard/catalog/inventory/inventory-product-row"
import { InventorySummary } from "@/components/dashboard/catalog/inventory/inventory-summary"
import { ProductDetailDialog } from "@/components/dashboard/catalog/products/product-detail-dialog"
import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { InventoryRowsSkeleton } from "@/components/skeletons/inventory-management-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import { getCatalogInventory } from "@/lib/api/catalog"
import { getChannelSyncRun, syncChannelInventory } from "@/lib/api/channels"
import { cn } from "@/lib/utils"
import type { ChannelConnection } from "@/types/channel"
import type {
  InventoryItem,
  InventoryPage,
  InventorySort,
  InventoryStockFilter,
} from "@/types/inventory"
import type { SyncHistoryItem } from "@/types/sync-history"

const PAGE_SIZE = 20
const DEFAULT_LOW_STOCK_THRESHOLD = 5
const SEARCH_DEBOUNCE_MS = 300

const STOCK_FILTERS: Array<{
  value: InventoryStockFilter
  label: string
}> = [
  { value: "ALL", label: "Tüm durumlar" },
  { value: "IN_STOCK", label: "Stokta" },
  { value: "LOW_STOCK", label: "Azalan stok" },
  { value: "OUT_OF_STOCK", label: "Tükenen" },
  { value: "UNAVAILABLE", label: "Kullanılamayan" },
  { value: "STALE", label: "Güncel olmayan" },
]

const SORT_OPTIONS: Array<{ value: InventorySort; label: string }> = [
  { value: "CRITICAL_FIRST", label: "Kritik stok önce" },
  { value: "STOCK_ASC", label: "Stok: azdan çoğa" },
  { value: "STOCK_DESC", label: "Stok: çoktan aza" },
  { value: "RECENTLY_UPDATED", label: "Son güncellenen" },
]

export type InventoryFilters = {
  query: string
  status: InventoryStockFilter
  provider: string
  lowStockThreshold: number
  sort: InventorySort
}

type InventoryManagementProps = {
  storeId: string
  storeName: string
  initialPage: InventoryPage
  initialFilters: InventoryFilters
  connections: ChannelConnection[]
}

export function InventoryManagement({
  storeId,
  storeName,
  initialPage,
  initialFilters,
  connections,
}: InventoryManagementProps) {
  const pathname = usePathname()
  const [query, setQuery] = useState(initialFilters.query)
  const [status, setStatus] = useState(initialFilters.status)
  const [provider, setProvider] = useState(initialFilters.provider)
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialFilters.lowStockThreshold
  )
  const [sort, setSort] = useState(initialFilters.sort)
  const [page, setPage] = useState(initialPage)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [expandAll, setExpandAll] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activeSyncRunIds, setActiveSyncRunIds] = useState<string[]>([])
  const [activeSyncRuns, setActiveSyncRuns] = useState<SyncHistoryItem[]>([])
  const [isSyncPending, startSyncTransition] = useTransition()
  const loadMoreMarkerRef = useRef<HTMLDivElement | null>(null)
  const requestSequence = useRef(0)
  const syncPollInFlight = useRef(false)
  const inventoryFilterKey = createInventoryFilterKey(
    storeId,
    query,
    status,
    provider,
    lowStockThreshold
  )
  const loadedFilterKey = useRef(
    createInventoryFilterKey(
      storeId,
      initialFilters.query,
      initialFilters.status,
      initialFilters.provider,
      initialFilters.lowStockThreshold
    )
  )
  const connectedChannels = connections.filter(
    (connection) =>
      connection.type === "COMMERCE" && connection.status === "CONNECTED"
  )
  const products = useMemo(() => {
    return sortInventoryProducts(
      groupInventoryByProduct(page.items),
      sort,
      lowStockThreshold
    )
  }, [lowStockThreshold, page.items, sort])
  const isSyncing = isSyncPending || activeSyncRunIds.length > 0

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal, quiet = false) => {
      const requestId = ++requestSequence.current
      if (!quiet) setIsLoadingPage(true)
      setError(null)

      try {
        const result = await getCatalogInventory(storeId, {
          query,
          status,
          provider,
          lowStockThreshold,
          limit: PAGE_SIZE,
          signal,
        })

        if (requestId !== requestSequence.current) return
        loadedFilterKey.current = inventoryFilterKey
        setPage(result)
      } catch (caughtError) {
        if (signal?.aborted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Stok bilgileri alınamadı."
        )
      } finally {
        if (requestId === requestSequence.current && !quiet) {
          setIsLoadingPage(false)
        }
      }
    },
    [inventoryFilterKey, lowStockThreshold, provider, query, status, storeId]
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      updateUrl({ query, status, provider, lowStockThreshold, sort }, pathname)
      setExpandAll(false)
      if (inventoryFilterKey !== loadedFilterKey.current) {
        void loadFirstPage(controller.signal)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    inventoryFilterKey,
    loadFirstPage,
    lowStockThreshold,
    pathname,
    provider,
    query,
    sort,
    status,
  ])

  const loadMore = useCallback(async () => {
    if (!page.nextCursor || isLoadingPage || isLoadingMore) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const result = await getCatalogInventory(storeId, {
        cursor: page.nextCursor,
        query,
        status,
        provider,
        lowStockThreshold,
        limit: PAGE_SIZE,
      })
      setPage((current) => ({
        ...result,
        items: mergeInventoryItems(current.items, result.items),
      }))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer stok kayıtları yüklenemedi."
      )
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoadingMore,
    isLoadingPage,
    lowStockThreshold,
    page.nextCursor,
    provider,
    query,
    status,
    storeId,
  ])

  useEffect(() => {
    const marker = loadMoreMarkerRef.current
    if (!marker || !page.nextCursor) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: "320px 0px" }
    )

    observer.observe(marker)
    return () => observer.disconnect()
  }, [loadMore, page.nextCursor])

  function handleInventorySync() {
    if (connectedChannels.length === 0 || isSyncing) return

    setSyncError(null)
    setMessage(null)

    startSyncTransition(async () => {
      const results = await Promise.allSettled(
        connectedChannels.map((connection) =>
          syncChannelInventory(storeId, connection.id)
        )
      )
      const queuedRuns = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      )

      if (queuedRuns.length === 0) {
        const rejected = results.find((result) => result.status === "rejected")
        setSyncError(
          rejected?.status === "rejected" && rejected.reason instanceof Error
            ? rejected.reason.message
            : "Stok senkronizasyonu başlatılamadı."
        )
        return
      }

      setActiveSyncRunIds(queuedRuns.map((run) => run.syncRunId))
      setActiveSyncRuns([])
      setMessage(`${queuedRuns.length} kanal için stok kontrolü başlatıldı.`)
    })
  }

  useEffect(() => {
    if (activeSyncRunIds.length === 0) return

    let cancelled = false

    async function pollSyncRuns() {
      if (syncPollInFlight.current) return
      syncPollInFlight.current = true

      try {
        const runs = await Promise.all(
          activeSyncRunIds.map((runId) => getChannelSyncRun(storeId, runId))
        )
        if (cancelled) return

        setActiveSyncRuns(runs)
        const running = runs.some((run) => run.status === "RUNNING")
        if (running) return

        const failed = runs.filter((run) => run.status === "FAILED")
        setActiveSyncRunIds([])
        setActiveSyncRuns([])
        if (failed.length > 0) {
          setSyncError(
            failed.length === runs.length
              ? "Stok kontrolleri tamamlanamadı. Ayrıntıları Senkron Geçmişi'nden inceleyin."
              : `${failed.length} kanalın stok kontrolü tamamlanamadı.`
          )
        } else {
          const checkedVariants = runs.reduce(
            (total, run) => total + run.variantsProcessed,
            0
          )
          setMessage(
            `${checkedVariants.toLocaleString("tr-TR")} varyantın stok bilgisi güncellendi.`
          )
        }
        await loadFirstPage(undefined, true)
      } catch (caughtError) {
        if (!cancelled) {
          setSyncError(
            caughtError instanceof Error
              ? caughtError.message
              : "Stok kontrolünün durumu alınamadı."
          )
        }
      } finally {
        syncPollInFlight.current = false
      }
    }

    void pollSyncRuns()
    const intervalId = window.setInterval(() => {
      void pollSyncRuns()
    }, 1_500)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeSyncRunIds, loadFirstPage, storeId])

  function resetFilters() {
    setQuery("")
    setStatus("ALL")
    setProvider("ALL")
    setLowStockThreshold(DEFAULT_LOW_STOCK_THRESHOLD)
    setSort("CRITICAL_FIRST")
  }

  const lastSyncedAt = page.summary.lastSyncedAt
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      }).format(new Date(page.summary.lastSyncedAt))
    : null
  const completedSyncRuns = activeSyncRuns.filter(
    (run) => run.status !== "RUNNING"
  ).length
  const activeFilterCount = [
    Boolean(query.trim()),
    status !== "ALL",
    provider !== "ALL",
    lowStockThreshold !== DEFAULT_LOW_STOCK_THRESHOLD,
    sort !== "CRITICAL_FIRST",
  ].filter(Boolean).length

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Stok Takibi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasındaki ürün varyantlarının pazaryerlerinden gelen
            güncel stok durumunu takip edin.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            <span>
              {lastSyncedAt
                ? `Son stok kontrolü ${lastSyncedAt}`
                : "Henüz tamamlanmış bir stok kontrolü bulunmuyor."}
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleInventorySync}
          disabled={connectedChannels.length === 0 || isSyncing}
          title={
            connectedChannels.length === 0
              ? "Önce bir pazaryeri bağlantısı kurun"
              : undefined
          }
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-4 ${isSyncing ? "animate-spin" : ""}`}
          />
          {isSyncing ? "Stoklar kontrol ediliyor" : "Stokları güncelle"}
        </Button>
      </div>

      {isSyncing || syncError || message ? (
        <SyncStatusNotice
          isSyncing={isSyncing}
          completed={completedSyncRuns}
          total={activeSyncRunIds.length}
          error={syncError}
          message={message}
        />
      ) : null}

      <div className="mt-6">
        <InventorySummary summary={page.summary} />
      </div>

      {initialPage.summary.variants === 0 ? (
        <EmptyInventory hasConnectedChannel={connectedChannels.length > 0} />
      ) : (
        <>
          <div className="mt-6 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-sm">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ürün, SKU, barkod, renk veya beden ara"
                  className="h-9! border-border bg-card pl-9"
                  aria-label="Stoklarda ara"
                />
              </div>

              <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as InventoryStockFilter)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="h-9! border-border bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {STOCK_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger
                    size="sm"
                    className="h-9! border-border bg-card"
                  >
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

                <Select
                  value={String(lowStockThreshold)}
                  onValueChange={(value) => setLowStockThreshold(Number(value))}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-9! border-border bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {[3, 5, 10, 20].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        Az stok ≤ {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sort}
                  onValueChange={(value) => setSort(value as InventorySort)}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-9! min-w-40 border-border bg-card"
                    aria-label="Stokları sırala"
                  >
                    <HugeiconsIcon
                      icon={ArrowUpDownIcon}
                      className="size-3.5 text-muted-foreground"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {products.length.toLocaleString("tr-TR")} /{" "}
                {page.total.toLocaleString("tr-TR")} ürün ·{" "}
                {page.items.length.toLocaleString("tr-TR")} /{" "}
                {page.variantTotal.toLocaleString("tr-TR")} varyant
              </p>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    Filtreleri temizle ({activeFilterCount})
                  </Button>
                ) : null}
                {products.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setExpandAll((current) => !current)}
                  >
                    {expandAll ? "Tümünü kapat" : "Tümünü aç"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3">
            {isLoadingPage ? (
              <InventoryRowsSkeleton />
            ) : page.items.length === 0 ? (
              <NoInventoryResults onReset={resetFilters} />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="hidden grid-cols-[minmax(0,1fr)_8.5rem_5rem] gap-3 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:grid">
                  <span className="pl-23">Ürün</span>
                  <span>Durum</span>
                  <span>Stok</span>
                </div>
                {products.map((product) => (
                  <InventoryProductRow
                    key={`${product.productId}-${expandAll}`}
                    product={product}
                    lowStockThreshold={lowStockThreshold}
                    forceOpen={expandAll}
                    onSelect={setSelectedProductId}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            ref={loadMoreMarkerRef}
            className="flex min-h-16 items-center justify-center"
            aria-live="polite"
          >
            {isLoadingMore && page.nextCursor ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-3.5 animate-spin"
                />
                Diğer varyantlar yükleniyor...
              </span>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-xs text-destructive">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    page.nextCursor ? void loadMore() : void loadFirstPage()
                  }
                >
                  Tekrar dene
                </Button>
              </div>
            ) : page.nextCursor ? (
              <span className="text-xs text-muted-foreground">
                Daha fazla varyant için aşağı kaydırın
              </span>
            ) : page.items.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Tüm stok kayıtları gösteriliyor
              </span>
            ) : null}
          </div>
        </>
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

function EmptyInventory({
  hasConnectedChannel,
}: {
  hasConnectedChannel: boolean
}) {
  return (
    <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={Package01Icon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">
        Stok kaydı bulunmuyor
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {hasConnectedChannel
          ? "Bağlı pazaryerindeki ürünleri senkronize ederek stok kayıtlarını oluşturun."
          : "Stokları takip etmek için önce Trendyol veya Hepsiburada bağlantısı kurun."}
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={APP_ROUTES.dashboard.channels.root}>
          Satış kanallarına git
        </Link>
      </Button>
    </div>
  )
}

function NoInventoryResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <HugeiconsIcon icon={Search01Icon} className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold text-foreground">
        Eşleşen stok kaydı bulunamadı
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Arama ifadesini veya seçili filtreleri değiştirin.
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

function mergeInventoryItems(
  current: InventoryItem[],
  incoming: InventoryItem[]
) {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item])
    ).values(),
  ]
}

function groupInventoryByProduct(
  items: InventoryItem[]
): InventoryProductGroup[] {
  const products = new Map<string, InventoryProductGroup>()

  items.forEach((item) => {
    const product = products.get(item.productId)

    if (product) {
      product.variants.push(item)
      product.providers = [
        ...new Set([...product.providers, ...item.providers]),
      ]
      product.lastSyncedAt = latestDate(product.lastSyncedAt, item.lastSyncedAt)
      product.freshness = mergeFreshness(product.freshness, item.freshness)
      return
    }

    products.set(item.productId, {
      productId: item.productId,
      productTitle: item.productTitle,
      productBrand: item.productBrand,
      productCategory: item.productCategory,
      imageUrl: item.imageUrl,
      variants: [item],
      providers: item.providers,
      lastSyncedAt: item.lastSyncedAt,
      freshness: item.freshness,
    })
  })

  return [...products.values()]
}

function sortInventoryProducts(
  products: InventoryProductGroup[],
  sort: InventorySort,
  lowStockThreshold: number
) {
  return [...products].sort((left, right) => {
    const leftStock = productStock(left)
    const rightStock = productStock(right)

    if (sort === "STOCK_ASC") return leftStock - rightStock
    if (sort === "STOCK_DESC") return rightStock - leftStock
    if (sort === "RECENTLY_UPDATED") {
      return dateValue(right.lastSyncedAt) - dateValue(left.lastSyncedAt)
    }

    const priorityDifference =
      productPriority(left, lowStockThreshold) -
      productPriority(right, lowStockThreshold)
    return priorityDifference || leftStock - rightStock
  })
}

function productStock(product: InventoryProductGroup) {
  return product.variants.reduce(
    (total, variant) => total + Math.max(variant.stock, 0),
    0
  )
}

function productPriority(
  product: InventoryProductGroup,
  lowStockThreshold: number
) {
  if (product.freshness !== "FRESH") return 0
  if (product.variants.every((variant) => variant.status === "UNAVAILABLE")) {
    return 1
  }
  if (productStock(product) === 0) return 2
  if (
    product.variants.some(
      (variant) => variant.stock > 0 && variant.stock <= lowStockThreshold
    )
  ) {
    return 3
  }
  return 4
}

function mergeFreshness(
  current: InventoryItem["freshness"],
  incoming: InventoryItem["freshness"]
) {
  if (current === "STALE" || incoming === "STALE") return "STALE"
  if (current === "UNKNOWN" || incoming === "UNKNOWN") return "UNKNOWN"
  return "FRESH"
}

function latestDate(left: string | null, right: string | null) {
  if (!left) return right
  if (!right) return left
  return dateValue(left) >= dateValue(right) ? left : right
}

function dateValue(value: string | null) {
  if (!value) return 0
  const date = new Date(value).getTime()
  return Number.isFinite(date) ? date : 0
}

function createInventoryFilterKey(
  storeId: string,
  query: string,
  status: InventoryStockFilter,
  provider: string,
  lowStockThreshold: number
) {
  return [
    storeId,
    query.trim(),
    status,
    provider,
    lowStockThreshold,
  ].join("|")
}

function updateUrl(filters: InventoryFilters, pathname: string) {
  const params = new URLSearchParams()
  const query = filters.query.trim()

  if (query) params.set("q", query)
  if (filters.status !== "ALL") {
    params.set("status", filters.status.toLowerCase())
  }
  if (filters.provider !== "ALL") params.set("provider", filters.provider)
  if (filters.lowStockThreshold !== DEFAULT_LOW_STOCK_THRESHOLD) {
    params.set("threshold", String(filters.lowStockThreshold))
  }
  if (filters.sort !== "CRITICAL_FIRST") {
    params.set("sort", filters.sort.toLowerCase())
  }

  const queryString = params.toString()
  window.history.replaceState(
    null,
    "",
    queryString ? `${pathname}?${queryString}` : pathname
  )
}

function SyncStatusNotice({
  isSyncing,
  completed,
  total,
  error,
  message,
}: {
  isSyncing: boolean
  completed: number
  total: number
  error: string | null
  message: string | null
}) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 8

  return (
    <div
      className={cn(
        "mt-5 overflow-hidden rounded-lg border px-4 py-3",
        error
          ? "border-destructive/25 bg-destructive/5"
          : "border-primary/15 bg-primary/5"
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            error
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          <HugeiconsIcon
            icon={isSyncing ? RefreshIcon : error ? Clock01Icon : Package01Icon}
            className={cn("size-4", isSyncing && "animate-spin")}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              error ? "text-destructive" : "text-foreground"
            )}
          >
            {isSyncing
              ? "Pazaryeri stokları kontrol ediliyor"
              : error
                ? "Stok kontrolü tamamlanamadı"
                : "Stok bilgileri güncellendi"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {error ??
              (isSyncing && total > 0
                ? `${completed} / ${total} kanal tamamlandı. Sayfayı yenilemeniz gerekmiyor.`
                : message)}
          </p>
        </div>
      </div>
      {isSyncing ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.max(progress, 8)}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
