"use client"

import { useMemo, useState } from "react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyCatalog } from "@/components/dashboard/catalog/products/empty-catalog"
import { NoSearchResults } from "@/components/dashboard/catalog/products/no-search-results"
import { ProductCard } from "@/components/dashboard/catalog/products/product-card"
import type { CatalogProduct } from "@/types/product"

export type ProductCatalogProps = {
  products: CatalogProduct[]
}

export function ProductCatalog({ products }: ProductCatalogProps) {
  const [query, setQuery] = useState("")
  const [openProductIds, setOpenProductIds] = useState<Set<string>>(
    () => new Set()
  )
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")

    if (!normalizedQuery) return products

    return products.filter((product) => {
      const searchableValues = [
        product.title,
        product.brand,
        product.category,
        ...product.variants.flatMap((variant) => [
          variant.sku,
          variant.barcode,
          variant.color,
          variant.size,
        ]),
      ]

      return searchableValues.some((value) =>
        value?.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      )
    })
  }, [products, query])
  const allVisibleProductsOpen =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => openProductIds.has(product.id))

  function setProductOpen(productId: string, open: boolean) {
    setOpenProductIds((current) => {
      const next = new Set(current)

      if (open) next.add(productId)
      else next.delete(productId)

      return next
    })
  }

  function openAllVisibleProducts() {
    setOpenProductIds((current) => {
      const next = new Set(current)
      filteredProducts.forEach((product) => next.add(product.id))
      return next
    })
  }

  function closeAllVisibleProducts() {
    setOpenProductIds((current) => {
      const next = new Set(current)
      filteredProducts.forEach((product) => next.delete(product.id))
      return next
    })
  }

  if (products.length === 0) {
    return <EmptyCatalog />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün, SKU, barkod, renk veya beden ara"
            className="h-9! pl-9"
            aria-label="Katalogda ara"
          />
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openAllVisibleProducts}
            disabled={allVisibleProductsOpen || filteredProducts.length === 0}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
            Tümünü aç
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={closeAllVisibleProducts}
            disabled={
              filteredProducts.length === 0 ||
              !filteredProducts.some((product) =>
                openProductIds.has(product.id)
              )
            }
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
            Tümünü kapat
          </Button>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <NoSearchResults query={query} onClear={() => setQuery("")} />
      ) : (
        <div className="grid gap-2.5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              open={openProductIds.has(product.id)}
              onOpenChange={(open) => setProductOpen(product.id, open)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
