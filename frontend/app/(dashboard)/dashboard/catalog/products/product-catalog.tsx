"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { CatalogBadge } from "@/components/dashboard/catalog/products/catalog-badge"
import { CatalogStockSync } from "@/components/dashboard/catalog/products/catalog-stock-sync"
import { CatalogToolbar } from "@/components/dashboard/catalog/products/catalog-toolbar"
import { CompactProductCard } from "@/components/dashboard/catalog/products/compact-product-card"
import { EmptyCatalog } from "@/components/dashboard/catalog/products/empty-catalog"
import { NoSearchResults } from "@/components/dashboard/catalog/products/no-search-results"
import { ProductCard } from "@/components/dashboard/catalog/products/product-card"
import { ProductDetailDialog } from "@/components/dashboard/catalog/products/product-detail-dialog"
import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProductCardGridSkeleton } from "@/components/skeletons/product-catalog-skeleton"
import { Button } from "@/components/ui/button"
import { PRODUCT_CATALOG_GRID } from "@/constants/catalog"
import { useCatalogView } from "@/hooks/use-catalog-view"
import { useProductCatalog } from "@/hooks/use-product-catalog"
import type { ChannelConnection } from "@/types/channel"
import type { CatalogProductPage } from "@/types/product"

export type ProductCatalogProps = {
  storeId: string
  initialPage: CatalogProductPage
  connections: ChannelConnection[]
  canManageStore: boolean
}

export function ProductCatalog({
  storeId,
  initialPage,
  connections,
  canManageStore,
}: ProductCatalogProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedProductId = searchParams.get("product")
  const [view, setView] = useCatalogView()
  const {
    query,
    setQuery,
    provider,
    setProvider,
    page,
    loading,
    error,
    loadedFilters,
    loadMore,
    refresh,
    revision,
  } = useProductCatalog(storeId, initialPage)
  const loadMoreMarkerRef = useRef<HTMLDivElement>(null)
  const providers = [
    ...new Set(
      connections
        .filter(
          (connection) =>
            connection.type === "COMMERCE" && connection.status === "CONNECTED"
        )
        .map((connection) => connection.providerKey)
    ),
  ].map((key) => ({ key, name: getProviderName(key) }))

  const selectProduct = useCallback(
    (productId: string | null) => {
      const params = new URLSearchParams(window.location.search)
      if (productId) params.set("product", productId)
      else params.delete("product")
      const queryString = params.toString()
      window.history.replaceState(
        null,
        "",
        queryString ? `${pathname}?${queryString}` : pathname
      )
    },
    [pathname]
  )

  useEffect(() => {
    const marker = loadMoreMarkerRef.current
    if (!marker || !page.nextCursor || loading || error) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: "320px 0px" }
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [loadMore, page.nextCursor, loading, error, view])

  const Card = view === "compact" ? CompactProductCard : ProductCard

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-col justify-between gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-start">
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Ürünler
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pazaryerlerindeki ürünlerinizi tek bir katalogdan takip edin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CatalogBadge label="Ürün" value={page.summary.products} />
            <CatalogBadge label="Varyant" value={page.summary.variants} />
            <CatalogBadge label="Toplam stok" value={page.summary.totalStock} />
          </div>
        </div>
        {canManageStore ? (
          <CatalogStockSync
            storeId={storeId}
            connections={connections}
            provider={provider}
            onCompleted={refresh}
          />
        ) : null}
      </div>

      <CatalogToolbar
        query={query}
        onQueryChange={setQuery}
        provider={provider}
        onProviderChange={setProvider}
        providers={providers}
        view={view}
        onViewChange={setView}
        shown={page.items.length}
        total={page.total}
        isLoading={loading === "replace" || loading === "refresh"}
      />

      <div aria-busy={loading !== null}>
        {view === null ? (
          <ProductCardGridSkeleton />
        ) : loading === "replace" ? (
          <ProductCardGridSkeleton view={view} />
        ) : page.summary.products === 0 ? (
          <EmptyCatalog canManageStore={canManageStore} />
        ) : page.items.length === 0 && !error ? (
          <NoSearchResults
            query={loadedFilters.query}
            providerName={
              providers.find((item) => item.key === loadedFilters.provider)
                ?.name
            }
            onClear={() => {
              setQuery("")
              setProvider("ALL")
            }}
          />
        ) : (
          <>
            <div className={PRODUCT_CATALOG_GRID[view]}>
              {page.items.map((product) => (
                <Card
                  key={product.id}
                  product={product}
                  onSelect={selectProduct}
                />
              ))}
            </div>
            {loading === "more" ? (
              <div className="mt-3">
                <ProductCardGridSkeleton count={3} view={view} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div
        ref={loadMoreMarkerRef}
        className="flex min-h-12 items-center justify-center"
        aria-live="polite"
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={refresh}>
              Tekrar dene
            </Button>
          </div>
        ) : loading ? (
          <span className="sr-only">Ürünler yükleniyor...</span>
        ) : page.nextCursor ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={loadMore}
          >
            Daha fazla ürün göster
          </Button>
        ) : page.items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            Tüm ürünler gösteriliyor
          </span>
        ) : null}
      </div>

      <ProductDetailDialog
        key={revision}
        storeId={storeId}
        productId={selectedProductId}
        open={selectedProductId !== null}
        onOpenChange={(open) => {
          if (!open) selectProduct(null)
        }}
      />
    </div>
  )
}
