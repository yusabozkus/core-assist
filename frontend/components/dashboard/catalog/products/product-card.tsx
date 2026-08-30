import { Badge } from "@/components/ui/badge"
import { ProductThumbnail } from "@/components/dashboard/catalog/products/product-thumbnail"
import {
  formatPrice,
  getProviderName,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import type { CatalogProductListItem } from "@/types/product"

type ProductCardProps = {
  product: CatalogProductListItem
  onSelect: (productId: string) => void
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const sourceNames = product.providers
    .map((source) => getProviderName(source.providerKey))
    .join(", ")

  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className="group flex min-w-0 items-stretch gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`${product.title} detaylarını görüntüle`}
    >
      <ProductThumbnail title={product.title} imageUrl={product.imageUrl} />
      <span className="flex min-w-0 flex-1 flex-col py-0.5">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm leading-5 font-semibold text-foreground">
            {product.title}
          </span>
          {sourceNames ? (
            <Badge
              variant="outline"
              className="max-w-25 shrink-0 truncate bg-background text-[10px]"
            >
              {sourceNames}
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 truncate text-xs text-muted-foreground">
          {[product.brand, product.category].filter(Boolean).join(" · ") ||
            "Kategori bilgisi bulunmuyor"}
        </span>

        <span className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pt-3">
          <span className="min-w-0">
            <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Fiyat
            </span>
            <span className="block truncate text-sm font-semibold text-foreground tabular-nums">
              {formatListPrice(product)}
            </span>
          </span>
          <span className="text-right text-xs text-muted-foreground">
            <span className="block whitespace-nowrap">
              {product.variantCount} varyant
            </span>
            <span
              className={`block font-medium whitespace-nowrap tabular-nums ${
                product.totalStock > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {product.totalStock} stok
            </span>
          </span>
        </span>
      </span>
    </button>
  )
}

function formatListPrice(product: CatalogProductListItem) {
  if (product.minimumPrice === null || product.maximumPrice === null) return "—"

  const minimum = formatPrice(product.minimumPrice, product.currency)
  if (product.minimumPrice === product.maximumPrice) return minimum

  return `${minimum} – ${formatPrice(product.maximumPrice, product.currency)}`
}
