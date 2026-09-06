import { memo } from "react"

import { ProductThumbnail } from "./product-thumbnail"
import {
  ProductCardInventory,
  ProductCardPrice,
  ProductCardProviders,
  type ProductCardProps,
} from "./product-card-meta"

export const ProductCard = memo(function ProductCard({
  product,
  onSelect,
}: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-xs transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${product.title} detaylarını görüntüle`}
    >
      <span className="relative block w-full border-b border-border/70 bg-muted/30 p-3">
        <ProductThumbnail
          title={product.title}
          imageUrl={product.imageUrl}
          sizes="(max-width: 640px) 90vw, (max-width: 1200px) 40vw, 360px"
          className="aspect-[4/3] h-auto w-full rounded-lg border-0 bg-white sm:h-auto sm:w-full"
          imageClassName="object-contain"
        />
      </span>
      <span className="flex w-full min-w-0 flex-1 flex-col gap-3 p-4">
        <span className="flex items-center justify-between gap-3">
          <span
            className="truncate text-xs font-medium text-muted-foreground"
            title={[product.brand, product.category]
              .filter(Boolean)
              .join(" · ")}
          >
            {[product.brand, product.category].filter(Boolean).join(" · ") ||
              "Kategori belirtilmemiş"}
          </span>
          <ProductCardProviders product={product} />
        </span>
        <span
          className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-foreground"
          title={product.title}
        >
          {product.title}
        </span>
        <span className="mt-auto block">
          <ProductCardPrice product={product} />
        </span>
        <span className="block border-t border-border/70 pt-3">
          <ProductCardInventory product={product} />
        </span>
      </span>
    </button>
  )
})
