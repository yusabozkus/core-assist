import { ChevronDownIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductSummary } from "@/components/dashboard/catalog/products/product-summary"
import { ProductThumbnail } from "@/components/dashboard/catalog/products/product-thumbnail"
import { VariantTable } from "@/components/dashboard/catalog/products/variant-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  formatCatalogDate,
  formatPriceRange,
  getProviderName,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import type { CatalogProduct } from "@/types/product"

type ProductCardProps = {
  product: CatalogProduct
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductCard({ product, open, onOpenChange }: ProductCardProps) {
  const totalStock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0
  )
  const sourceNames = product.externalProducts
    .map((source) => getProviderName(source.connection.providerKey))
    .join(", ")
  const variantsContentId = `product-variants-${product.id}`

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors hover:border-foreground/15">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-controls={variantsContentId}
          onClick={() => onOpenChange(!open)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onOpenChange(!open)
            }
          }}
          className="flex cursor-pointer items-center gap-3 p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:gap-4 sm:p-4"
        >
          <ProductThumbnail product={product} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {product.title}
              </h2>
              <Badge
                variant="outline"
                className="hidden max-w-36 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap sm:flex"
              >
                {sourceNames || "Pazaryeri"}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[product.brand, product.category].filter(Boolean).join(" · ") ||
                "Kategori bilgisi bulunmuyor"}
            </p>
            {product.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {product.description}
              </p>
            ) : null}
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs lg:hidden">
              <span
                className="truncate font-semibold text-foreground tabular-nums"
                title={formatPriceRange(product.variants)}
              >
                {formatPriceRange(product.variants)}
              </span>
              <span className="whitespace-nowrap text-muted-foreground">
                {product.variants.length} varyant
              </span>
              <span
                className={`whitespace-nowrap tabular-nums ${totalStock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {totalStock} stok
              </span>
            </div>
          </div>
          <div className="hidden w-[23rem] shrink-0 grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center border-l border-border pl-5 lg:grid [&>*+*]:border-l [&>*+*]:border-border [&>*+*]:pl-4">
            <ProductSummary
              label="Fiyat"
              value={formatPriceRange(product.variants)}
            />
            <ProductSummary
              label="Varyant"
              value={String(product.variants.length)}
            />
            <ProductSummary
              label="Stok"
              value={String(totalStock)}
              tone={totalStock > 0 ? "success" : "warning"}
            />
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground sm:h-9 sm:w-24 sm:px-3">
            <span className="hidden sm:inline">
              {open ? "Gizle" : "Varyantlar"}
            </span>
            <HugeiconsIcon
              icon={ChevronDownIcon}
              className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </div>
        <CollapsibleContent id={variantsContentId}>
          <div className="border-t border-border bg-muted/15">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Ürün detayları
                </p>
                {product.attributes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.attributes.map((attribute) => (
                      <Badge key={attribute.id} variant="secondary">
                        {attribute.name}: {attribute.value}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ek ürün özelliği bulunmuyor.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Güncellendi: {formatCatalogDate(product.updatedAt)}</span>
                {product.externalProducts[0]?.externalUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={product.externalProducts[0].externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <HugeiconsIcon
                        icon={LinkSquare02Icon}
                        className="size-3.5"
                      />
                      Pazaryerinde aç
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <VariantTable variants={product.variants} />
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}
