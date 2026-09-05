"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { EmptyCatalog } from "@/components/dashboard/catalog/products/empty-catalog"
import { NoSearchResults } from "@/components/dashboard/catalog/products/no-search-results"
import { ProductCard } from "@/components/dashboard/catalog/products/product-card"
import { ProductDetailDialog } from "@/components/dashboard/catalog/products/product-detail-dialog"
import { ProductCardGridSkeleton } from "@/components/skeletons/product-catalog-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  providers: Array<{ key: string; name: string }>
}

export function ProductCatalog({
  storeId,
  initialPage,
  providers,
}: ProductCatalogProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [provider, setProvider] = useState("ALL")
  const [activeProvider, setActiveProvider] = useState("ALL")
  const [products, setProducts] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [total, setTotal] = useState(initialPage.total)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    searchParams.get("product")
  )
  const loadMoreMarkerRef = useRef<HTMLDivElement | null>(null)
  const requestSequence = useRef(0)
  const lastRequestKey = useRef(`${storeId}|ALL|`)

  useEffect(() => {
    const linkedProductId = searchParams.get("product")
    setSelectedProductId(linkedProductId)
  }, [searchParams])

  function selectProduct(productId: string) {
    setSelectedProductId(productId)
    updateProductParam(productId)
  }

  function updateProductParam(productId: string | null) {
    const params = new URLSearchParams(searchParams.toString())

    if (productId) params.set("product", productId)
    else params.delete("product")

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }

  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestKey = `${storeId}|${provider}|${normalizedQuery}`

    if (requestKey === lastRequestKey.current) return

    const controller = new AbortController()
    const requestId = ++requestSequence.current
    const timeoutId = window.setTimeout(async () => {
      lastRequestKey.current = requestKey
      setIsLoading(true)
      setError(null)

      try {
        const page = await getCatalogProducts(storeId, {
          query: normalizedQuery,
          provider,
          limit: PAGE_SIZE,
          signal: controller.signal,
        })

        if (requestId !== requestSequence.current) return
        setActiveQuery(normalizedQuery)
        setActiveProvider(provider)
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
  }, [provider, query, storeId])

  const loadMore = useCallback(async () => {
    if (
      !nextCursor ||
      isLoading ||
      query.trim() !== activeQuery ||
      provider !== activeProvider
    ) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const page = await getCatalogProducts(storeId, {
        cursor: nextCursor,
        query: activeQuery,
        provider: activeProvider,
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
  }, [
    activeProvider,
    activeQuery,
    isLoading,
    nextCursor,
    provider,
    query,
    storeId,
  ])

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
  }

  if (initialPage.summary.products === 0) {
    return <EmptyCatalog />
  }

  const isReplacingResults =
    isLoading && (query.trim() !== activeQuery || provider !== activeProvider)
  const activeProviderName = providers.find(
    (item) => item.key === activeProvider
  )?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Ürün, SKU, barkod, renk veya özellik ara"
              icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
              className="h-9! border-border bg-card"
              aria-label="Katalogda ara"
            />
          </div>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger
              size="sm"
              aria-label="Pazaryerine göre filtrele"
              className="h-9! w-full rounded-xl border-border bg-card sm:w-44"
            >
              <SelectValue placeholder="Tüm pazaryerleri" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="ALL">Tüm pazaryerleri</SelectItem>
              {providers.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {products.length.toLocaleString("tr-TR")} /{" "}
          {total.toLocaleString("tr-TR")} ürün gösteriliyor
        </p>
      </div>

      {isReplacingResults ? (
        <ProductCardGridSkeleton />
      ) : products.length === 0 &&
        (activeQuery || activeProvider !== "ALL") &&
        !isLoading ? (
        <NoSearchResults
          query={activeQuery}
          providerName={activeProviderName}
          onClear={() => {
            setQuery("")
            setProvider("ALL")
          }}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={selectProduct}
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
          if (!open) {
            setSelectedProductId(null)
            updateProductParam(null)
          }
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
