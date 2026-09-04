"use client"

import { useEffect, useState } from "react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductDetailContent } from "@/components/dashboard/catalog/products/product-detail-content"
import { ProductMarketplaceAction } from "@/components/dashboard/catalog/products/product-marketplace-action"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ProductDetailSkeleton } from "@/components/skeletons/product-detail-skeleton"
import { getCatalogProduct } from "@/lib/api/catalog"
import type { CatalogProduct } from "@/types/product"

type ProductDetailDialogProps = {
  storeId: string
  productId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductDetailDialog({
  storeId,
  productId,
  open,
  onOpenChange,
}: ProductDetailDialogProps) {
  const [result, setResult] = useState<{
    productId: string | null
    product: CatalogProduct | null
    error: string | null
  }>({ productId: null, product: null, error: null })
  const [requestVersion, setRequestVersion] = useState(0)
  const product = result.productId === productId ? result.product : null
  const error = result.productId === productId ? result.error : null

  useEffect(() => {
    if (!open || !productId) return

    const controller = new AbortController()

    getCatalogProduct(storeId, productId, controller.signal)
      .then((loadedProduct) =>
        setResult({ productId, product: loadedProduct, error: null })
      )
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return
        setResult({
          productId,
          product: null,
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Ürün bilgileri alınamadı.",
        })
      })

    return () => controller.abort()
  }, [open, productId, requestVersion, storeId])

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product?.title ?? "Ürün detayları"}
      description={
        product
          ? [product.brand, product.category].filter(Boolean).join(" · ")
          : "Ürün bilgileri pazaryeri kataloğundan alınıyor."
      }
      headerActions={
        product ? (
          <ProductMarketplaceAction sources={product.externalProducts} />
        ) : null
      }
      contentClassName="sm:max-w-5xl"
      headerClassName={product ? "pr-32 sm:pr-48" : undefined}
      bodyClassName="themed-scrollbar px-0 py-0"
    >
      {error ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="max-w-md text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResult({ productId: null, product: null, error: null })
              setRequestVersion((current) => current + 1)
            }}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            Tekrar dene
          </Button>
        </div>
      ) : product ? (
        <ProductDetailContent product={product} />
      ) : (
        <ProductDetailSkeleton />
      )}
    </ResponsiveDialog>
  )
}
