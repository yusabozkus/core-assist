"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useCatalogView } from "@/hooks/use-catalog-view"
import {
  PRODUCT_CATALOG_GRID,
  type ProductCatalogView,
} from "@/constants/catalog"

export function ProductCardSkeleton({
  view = null,
}: {
  view?: ProductCatalogView | null
}) {
  if (view === null) {
    return (
      <div className="flex min-h-36 gap-3 rounded-xl border border-border bg-card p-3">
        <Skeleton className="h-28 w-22 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-auto h-4 w-3/5" />
        </div>
      </div>
    )
  }

  if (view === "compact") {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex gap-3">
          <Skeleton className="h-24 w-18 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-auto h-4 w-3/4" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border/70 p-3">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="size-6 rounded-md" />
        </div>
        <div className="min-h-10 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-5 w-3/5" />
        <div className="flex justify-between border-t border-border/70 pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  )
}

export function ProductCardGridSkeleton({
  count = 6,
  view = null,
}: {
  count?: number
  view?: ProductCatalogView | null
}) {
  return (
    <div
      className={
        view === null
          ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          : PRODUCT_CATALOG_GRID[view]
      }
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} view={view} />
      ))}
    </div>
  )
}

export function ProductCatalogSkeleton() {
  const [view] = useCatalogView()
  return (
    <div
      className="mx-auto w-full max-w-[1440px] space-y-6 px-5 py-8 sm:px-8 lg:px-10"
      aria-label="Ürünler yükleniyor"
      aria-busy="true"
    >
      <div className="flex flex-col justify-between gap-5 border-b border-border/70 pb-6 sm:flex-row">
        <div className="space-y-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-64" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-10 w-52 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
      <ProductCardGridSkeleton view={view} />
    </div>
  )
}
