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
import { useRouter } from "next/navigation"
import {
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
import { syncChannelInventory } from "@/lib/api/channels"
import type { ChannelConnection } from "@/types/channel"
import type {
  InventoryItem,
  InventoryPage,
  InventoryStockFilter,
} from "@/types/inventory"

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
]

type InventoryManagementProps = {
  storeId: string
  storeName: string
  initialPage: InventoryPage
  connections: ChannelConnection[]
}

export function InventoryManagement({
  storeId,
  storeName,
  initialPage,
  connections,
}: InventoryManagementProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<InventoryStockFilter>("ALL")
  const [provider, setProvider] = useState("ALL")
  const [lowStockThreshold, setLowStockThreshold] = useState(
    DEFAULT_LOW_STOCK_THRESHOLD
  )
  const [page, setPage] = useState(initialPage)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSyncPending, startSyncTransition] = useTransition()
  const loadMoreMarkerRef = useRef<HTMLDivElement | null>(null)
  const requestSequence = useRef(0)
  const refreshTimers = useRef<number[]>([])
  const isInitialRender = useRef(true)
  const connectedChannels = connections.filter(
    (connection) =>
      connection.type === "COMMERCE" && connection.status === "CONNECTED"
  )
  const products = useMemo(
    () => groupInventoryByProduct(page.items),
    [page.items]
  )

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++requestSequence.current
      setIsLoading(true)
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
        setPage(result)
      } catch (caughtError) {
        if (signal?.aborted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Stok bilgileri alınamadı."
        )
      } finally {
        if (requestId === requestSequence.current) setIsLoading(false)
      }
    },
    [lowStockThreshold, provider, query, status, storeId]
  )

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(
      () => void loadFirstPage(controller.signal),
      SEARCH_DEBOUNCE_MS
    )

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [loadFirstPage])

  useEffect(() => {
    return () => {
      refreshTimers.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!page.nextCursor || isLoading) return

    setIsLoading(true)
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
      setIsLoading(false)
    }
  }, [
    isLoading,
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
    if (connectedChannels.length === 0 || isSyncPending) return

    setError(null)
    setMessage(null)

    startSyncTransition(async () => {
      const results = await Promise.allSettled(
        connectedChannels.map((connection) =>
          syncChannelInventory(storeId, connection.id)
        )
      )
      const queued = results.filter(
        (result) => result.status === "fulfilled"
      ).length

      if (queued === 0) {
        const rejected = results.find((result) => result.status === "rejected")
        setError(
          rejected?.status === "rejected" && rejected.reason instanceof Error
            ? rejected.reason.message
            : "Stok senkronizasyonu başlatılamadı."
        )
        return
      }

      setMessage(
        `${queued} kanal için stok kontrolü kuyruğa alındı. Veriler tamamlandıkça yenilenecek.`
      )
      router.refresh()

      refreshTimers.current.forEach((timer) => window.clearTimeout(timer))
      refreshTimers.current = [1_500, 3_500].map((delay) =>
        window.setTimeout(() => {
          void loadFirstPage()
          router.refresh()
        }, delay)
      )
    })
  }

  function resetFilters() {
    setQuery("")
    setStatus("ALL")
    setProvider("ALL")
    setLowStockThreshold(DEFAULT_LOW_STOCK_THRESHOLD)
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

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Stok Yönetimi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasındaki ürün varyantlarının pazaryerlerinden gelen
            güncel stok durumunu takip edin.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {lastSyncedAt
              ? `Son stok kontrolü ${lastSyncedAt}`
              : "Henüz tamamlanmış bir stok kontrolü bulunmuyor."}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleInventorySync}
          disabled={connectedChannels.length === 0 || isSyncPending}
          title={
            connectedChannels.length === 0
              ? "Önce bir pazaryeri bağlantısı kurun"
              : undefined
          }
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-4 ${isSyncPending ? "animate-spin" : ""}`}
          />
          {isSyncPending ? "Kontrol başlatılıyor..." : "Stokları güncelle"}
        </Button>
      </div>

      <div className="mt-6">
        <InventorySummary summary={page.summary} />
      </div>

      {initialPage.summary.variants === 0 ? (
        <EmptyInventory hasConnectedChannel={connectedChannels.length > 0} />
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ürün, SKU, barkod, renk veya beden ara"
                className="h-9! pl-9"
                aria-label="Stoklarda ara"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as InventoryStockFilter)
                }
              >
                <SelectTrigger className="rounded-xl border-border bg-card">
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

              <Select
                value={String(lowStockThreshold)}
                onValueChange={(value) => setLowStockThreshold(Number(value))}
              >
                <SelectTrigger className="rounded-xl border-border bg-card">
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
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground tabular-nums">
              {products.length.toLocaleString("tr-TR")} /{" "}
              {page.total.toLocaleString("tr-TR")} ürün ·{" "}
              {page.items.length.toLocaleString("tr-TR")} varyant yüklendi
            </p>
            {message ? (
              <p className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            ) : null}
          </div>

          <div className="mt-3">
            {isLoading && page.items.length === 0 ? (
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
                    key={product.productId}
                    product={product}
                    lowStockThreshold={lowStockThreshold}
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
            {isLoading && page.nextCursor ? (
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
      return
    }

    products.set(item.productId, {
      productId: item.productId,
      productTitle: item.productTitle,
      productBrand: item.productBrand,
      productCategory: item.productCategory,
      imageUrl: item.imageUrl,
      variants: [item],
    })
  })

  return [...products.values()]
}
