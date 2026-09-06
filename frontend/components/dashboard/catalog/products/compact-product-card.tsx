import { memo } from "react"

import { ProductThumbnail } from "./product-thumbnail"
import {
  ProductCardInventory,
  ProductCardPrice,
  ProductCardProviders,
  type ProductCardProps,
} from "./product-card-meta"

export const CompactProductCard = memo(function CompactProductCard({
  product,
  onSelect,
}: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${product.title} detaylarını görüntüle`}
    >
      <span className="flex min-w-0 flex-1 gap-3">
        <ProductThumbnail
          title={product.title}
          imageUrl={product.imageUrl}
          sizes="72px"
          className="h-24 w-18 bg-white sm:h-24 sm:w-18"
          imageClassName="object-contain"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="line-clamp-2 text-[13px] leading-5 font-semibold text-foreground"
            title={product.title}
          >
            {product.title}
          </span>
          <span
            className="mt-1 truncate text-[11px] text-muted-foreground"
            title={[product.brand, product.category]
              .filter(Boolean)
              .join(" · ")}
          >
            {[product.brand, product.category].filter(Boolean).join(" · ") ||
              "Kategori belirtilmemiş"}
          </span>
          <span className="mt-auto block pt-2">
            <ProductCardPrice product={product} />
          </span>
        </span>
      </span>
      <span className="mt-3 flex w-full items-center gap-3 border-t border-border/70 pt-2.5">
        <ProductCardProviders product={product} />
        <span className="min-w-0 flex-1">
          <ProductCardInventory product={product} />
        </span>
      </span>
    </button>
  )
})
