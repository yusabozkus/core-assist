"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { EmptyCatalog } from "@/components/dashboard/catalog/products/empty-catalog"
import { NoSearchResults } from "@/components/dashboard/catalog/products/no-search-results"
import { ProductCard } from "@/components/dashboard/catalog/products/product-card"
import { ProductDetailDialog } from "@/components/dashboard/catalog/products/product-detail-dialog"
import { ProductCardGridSkeleton } from "@/components/skeletons/product-catalog-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCatalogProducts } from "@/lib/api/catalog"
import type {
  CatalogProductListItem,
  CatalogProductPage,
} from "@/types/product"

const PAGE_SIZE = 12
const SEARCH_DEBOUNCE_MS = 300

export type ProductCatalogProps = {
  storeId: string
  initialPage: CatalogProductPage
}

export function ProductCatalog({ storeId, initialPage }: ProductCatalogProps) {
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [products, setProducts] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [total, setTotal] = useState(initialPage.total)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  )
  const loadMoreMarkerRef = useRef<HTMLDivElement | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    const normalizedQuery = query.trim()

    if (!normalizedQuery) {
      requestSequence.current += 1
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      const requestId = ++requestSequence.current
      setIsLoading(true)
      setError(null)

      try {
        const page = await getCatalogProducts(storeId, {
          query: normalizedQuery,
          limit: PAGE_SIZE,
          signal: controller.signal,
        })

        if (requestId !== requestSequence.current) return
        setActiveQuery(normalizedQuery)
        setProducts(page.items)
        setNextCursor(page.nextCursor)
        setTotal(page.total)
      } catch (caughtError) {
        if (controller.signal.aborted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Ürünler aranırken bir hata oluştu."
        )
      } finally {
        if (requestId === requestSequence.current) setIsLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [initialPage, query, storeId])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoading || query.trim() !== activeQuery) return

    setIsLoading(true)
    setError(null)

    try {
      const page = await getCatalogProducts(storeId, {
        cursor: nextCursor,
        query: activeQuery,
        limit: PAGE_SIZE,
      })
      setProducts((current) => mergeProducts(current, page.items))
      setNextCursor(page.nextCursor)
      setTotal(page.total)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer ürünler yüklenemedi."
      )
    } finally {
      setIsLoading(false)
    }
  }, [activeQuery, isLoading, nextCursor, query, storeId])

  useEffect(() => {
    const marker = loadMoreMarkerRef.current
    if (!marker || !nextCursor) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: "320px 0px" }
    )

    observer.observe(marker)
    return () => observer.disconnect()
  }, [loadMore, nextCursor])

  function handleQueryChange(value: string) {
    setQuery(value)

    if (value.trim()) return

    setActiveQuery("")
    setProducts(initialPage.items)
    setNextCursor(initialPage.nextCursor)
    setTotal(initialPage.total)
    setError(null)
    setIsLoading(false)
  }

  if (initialPage.summary.products === 0) {
    return <EmptyCatalog />
  }

  const isReplacingResults =
    isLoading && Boolean(query.trim()) && query.trim() !== activeQuery

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Ürün, SKU, barkod, renk veya özellik ara"
            className="h-9! pl-9"
            aria-label="Katalogda ara"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {products.length.toLocaleString("tr-TR")} /{" "}
          {total.toLocaleString("tr-TR")} ürün gösteriliyor
        </p>
      </div>

      {isReplacingResults ? (
        <ProductCardGridSkeleton />
      ) : products.length === 0 && activeQuery && !isLoading ? (
        <NoSearchResults
          query={activeQuery}
          onClear={() => handleQueryChange("")}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelectedProductId}
              />
            ))}
          </div>
          {isLoading && nextCursor ? (
            <div className="mt-3">
              <ProductCardGridSkeleton count={3} />
            </div>
          ) : null}
        </>
      )}

      <div
        ref={loadMoreMarkerRef}
        className="flex min-h-14 items-center justify-center"
        aria-live="polite"
      >
        {isLoading ? (
          <span className="sr-only">Ürünler yükleniyor...</span>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-destructive">{error}</p>
            {nextCursor ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={loadMore}
              >
                Tekrar dene
              </Button>
            ) : null}
          </div>
        ) : nextCursor ? (
          <span className="text-xs text-muted-foreground">
            Daha fazla ürün için aşağı kaydırın
          </span>
        ) : products.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            Tüm ürünler gösteriliyor
          </span>
        ) : null}
      </div>

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

function mergeProducts(
  current: CatalogProductListItem[],
  incoming: CatalogProductListItem[]
) {
  return [
    ...new Map(
      [...current, ...incoming].map((product) => [product.id, product])
    ).values(),
  ]
}
