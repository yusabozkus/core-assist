import { ArrowRight01Icon, Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"

import { ProductDetailContent } from "@/components/dashboard/catalog/products/product-detail-content"
import { formatPriceRange } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProductMarketplaceAction } from "@/components/dashboard/catalog/products/product-marketplace-action"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import type { ProductQuestion } from "@/types/question"

export function ProductContext({
  storeId,
  question,
  onProductUpdated,
}: {
  storeId: string
  question: ProductQuestion
  onProductUpdated?: () => void | Promise<void>
}) {
  const product = question.product

  if (!product) {
    const snapshot = question.productSnapshot

    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
            {snapshot?.imageUrl ? (
              <Image
                src={snapshot.imageUrl}
                alt={snapshot.title}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <HugeiconsIcon icon={Package01Icon} className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-5 font-semibold text-foreground">
              {snapshot?.title ?? "Ürün eşleştirilemedi"}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {snapshot
                ? "Kanal bağlantısı kaldırıldığı için güncel ürün detayları kullanılamıyor."
                : `Platform ürün kodu: ${question.externalProductId}`}
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
      headerActions={
        <ProductMarketplaceAction sources={product.externalProducts} />
      }
      contentClassName="sm:max-w-5xl"
      headerClassName="pr-32 sm:pr-48"
      bodyClassName="px-0 py-0"
      trigger={
        <button
          type="button"
          className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-xs transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`${product.title} ürün detaylarını görüntüle`}
        >
          <span className="flex items-start gap-3 p-3.5">
            <span className="relative flex size-13 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.title}
                  fill
                  sizes="52px"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              ) : (
                <HugeiconsIcon icon={Package01Icon} className="size-5" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-5 font-semibold text-foreground">
                {product.title}
              </span>
              <span className="mt-2 flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground">
                  {productMeta || "Kategori bilgisi bulunmuyor"}
                </span>
                <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">
                  {formatPriceRange(product.variants)}
                </span>
              </span>
            </span>

            <span className="mt-4 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </span>
          </span>
        </button>
      }
    >
      <ProductDetailContent
        product={product}
        storeId={storeId}
        onProductUpdated={onProductUpdated}
      />
    </ResponsiveDialog>
  )
}
