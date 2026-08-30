import Image from "next/image"
import { ArrowRight01Icon, Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { formatPriceRange } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProductDetailContent } from "@/components/dashboard/catalog/products/product-detail-content"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import type { ProductQuestion } from "@/types/question"

export function ProductContext({ question }: { question: ProductQuestion }) {
  const product = question.product

  if (!product) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          İlgili ürün
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <HugeiconsIcon icon={Package01Icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Ürün eşleştirilemedi
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Platform ürün kodu: {question.externalProductId}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const imageUrl = product.images[0]?.url
  const productMeta = [product.brand, product.category]
    .filter(Boolean)
    .join(" · ")

  return (
    <ResponsiveDialog
      title={product.title}
      description={productMeta || "Ürün ve varyant detayları"}
      contentClassName="sm:max-w-5xl"
      bodyClassName="px-0 py-0"
      trigger={
        <button
          type="button"
          className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/20 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`${product.title} ürün detaylarını görüntüle`}
        >
          <span className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
            <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.title}
                  fill
                  sizes="64px"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <HugeiconsIcon icon={Package01Icon} className="size-5" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                İlgili ürün
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-foreground">
                {product.title}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {productMeta || "Kategori bilgisi bulunmuyor"}
              </span>
              <span className="mt-2 block text-sm font-semibold text-foreground tabular-nums sm:hidden">
                {formatPriceRange(product.variants)}
              </span>
            </span>

            <span className="hidden min-w-28 shrink-0 border-l border-border pl-4 sm:block">
              <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Fiyat
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-foreground tabular-nums">
                {formatPriceRange(product.variants)}
              </span>
            </span>

            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </span>
          </span>
        </button>
      }
    >
      <ProductDetailContent product={product} />
    </ResponsiveDialog>
  )
}
