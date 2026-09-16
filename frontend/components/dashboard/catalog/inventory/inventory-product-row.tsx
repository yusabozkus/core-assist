"use client"

import { useState } from "react"
import Image from "next/image"
import {
  ChevronRightIcon,
  Clock01Icon,
  Package01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogoStack } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { InventoryFreshness, InventoryItem } from "@/types/inventory"

export type InventoryProductGroup = {
  productId: string
  productTitle: string
  productBrand: string | null
  productCategory: string | null
  imageUrl: string | null
  variants: InventoryItem[]
  providers: string[]
  lastSyncedAt: string | null
  freshness: InventoryFreshness
}

type InventoryProductRowProps = {
  product: InventoryProductGroup
  lowStockThreshold: number
  forceOpen: boolean
  onSelect: (productId: string) => void
}

export function InventoryProductRow({
  product,
  lowStockThreshold,
  forceOpen,
  onSelect,
}: InventoryProductRowProps) {
  const [open, setOpen] = useState(forceOpen)

  const totalStock = product.variants.reduce(
    (total, variant) => total + Math.max(variant.stock, 0),
    0
  )
  const availability = getProductAvailability(
    product.variants,
    lowStockThreshold
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8.5rem_5rem] sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={open ? "Varyantları kapat" : "Varyantları göster"}
              className="shrink-0 text-muted-foreground"
            >
              <HugeiconsIcon
                icon={ChevronRightIcon}
                className={cn(
                  "size-4 transition-transform duration-200",
                  open && "rotate-90"
                )}
              />
            </Button>
          </CollapsibleTrigger>

          <InventoryThumbnail
            title={product.productTitle}
            imageUrl={product.imageUrl}
          />

          <button
            type="button"
            onClick={() => onSelect(product.productId)}
            className="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="line-clamp-2 text-sm leading-5 font-semibold text-foreground">
              {product.productTitle}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {[product.productBrand, product.productCategory]
                .filter(Boolean)
                .join(" · ") || "Kategori bilgisi bulunmuyor"}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <ProviderLogoStack
                  providers={product.providers}
                  sizes="16px"
                  logoClassName="size-4 rounded-sm"
                />
                <span className="truncate">
                  {product.providers.map(getProviderName).join(", ") ||
                    "Kanal bilgisi yok"}
                </span>
              </span>
              {product.freshness !== "FRESH" ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                  Güncelleme gerekli
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground sm:hidden">
              {product.variants.length} varyant
            </span>
          </button>
        </div>

        <div className="justify-self-end sm:justify-self-start">
          <StockStatusBadge availability={availability} />
        </div>

        <div className="col-span-2 flex items-center justify-between pl-11 text-xs sm:col-span-1 sm:block sm:pl-0 sm:text-sm">
          <span className="text-muted-foreground sm:hidden">Toplam stok</span>
          <span className="font-semibold text-foreground tabular-nums">
            {totalStock.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-b border-border bg-muted/20 px-3 py-1.5 sm:px-4 lg:px-5">
          {product.variants.map((variant, index) => {
            const variantAvailability = getVariantAvailability(
              variant,
              lowStockThreshold
            )
            const structuredDetails = [variant.color, variant.size].filter(
              Boolean
            )
            const variantLabel =
              structuredDetails.length > 0
                ? structuredDetails.join(" / ")
                : variant.title || `Varyant ${index + 1}`

            return (
              <div
                key={variant.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8.5rem_5rem]"
              >
                <div className="flex min-w-0 items-center gap-3 pl-11 sm:pl-12">
                  <span
                    className="h-px w-3 shrink-0 bg-border"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {variantLabel}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {variant.sku}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {variant.providers.map(getProviderName).join(", ") ||
                        "Kanal bilgisi yok"}
                      {variant.freshness !== "FRESH"
                        ? " · Güncelleme gerekli"
                        : " · Güncel"}
                    </span>
                    {variant.channelStocks.length > 1 ? (
                      <span
                        className={cn(
                          "mt-1 block truncate text-[10px]",
                          variant.hasStockConflict
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {variant.channelStocks
                          .map(
                            (channel) =>
                              `${getProviderName(channel.providerKey)} ${Math.max(channel.stock, 0).toLocaleString("tr-TR")}`
                          )
                          .join(" · ")}
                        {variant.hasStockConflict ? " · Stok farkı" : ""}
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="justify-self-end sm:justify-self-start">
                  <StockStatusBadge availability={variantAvailability} />
                </div>

                <div className="col-span-2 flex items-center justify-between pl-11 text-xs sm:col-span-1 sm:block sm:pl-0 sm:text-sm">
                  <span className="text-muted-foreground sm:hidden">Stok</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {Math.max(variant.stock, 0).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type StockAvailability = "AVAILABLE" | "LOW" | "OUT" | "UNAVAILABLE"

function StockStatusBadge({
  availability,
}: {
  availability: StockAvailability
}) {
  if (availability === "OUT") {
    return (
      <Badge className="border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
        Tükendi
      </Badge>
    )
  }

  if (availability === "UNAVAILABLE") {
    return <Badge variant="secondary">Kullanılamıyor</Badge>
  }

  if (availability === "LOW") {
    return <Badge variant="warning">Azalıyor</Badge>
  }

  return <Badge variant="success">Stok var</Badge>
}

function getProductAvailability(
  variants: InventoryItem[],
  lowStockThreshold: number
): StockAvailability {
  const totalStock = variants.reduce(
    (total, variant) => total + Math.max(variant.stock, 0),
    0
  )

  if (variants.every((variant) => variant.status === "UNAVAILABLE")) {
    return "UNAVAILABLE"
  }

  if (totalStock === 0) return "OUT"

  const hasCriticalVariant = variants.some(
    (variant) =>
      variant.stock <= lowStockThreshold || variant.status !== "ACTIVE"
  )

  return hasCriticalVariant ? "LOW" : "AVAILABLE"
}

function getVariantAvailability(
  variant: InventoryItem,
  lowStockThreshold: number
): StockAvailability {
  if (variant.status === "UNAVAILABLE") return "UNAVAILABLE"
  if (variant.stock <= 0 || variant.status === "OUT_OF_STOCK") return "OUT"

  if (variant.stock <= lowStockThreshold || variant.status !== "ACTIVE") {
    return "LOW"
  }

  return "AVAILABLE"
}

function InventoryThumbnail({
  title,
  imageUrl,
}: {
  title: string
  imageUrl: string | null
}) {
  const [failed, setFailed] = useState(false)
  const supportedImageUrl =
    imageUrl?.startsWith("/") || imageUrl?.startsWith("https://")

  return (
    <span className="relative flex size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-12">
      {imageUrl && supportedImageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="48px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-5" />
        </span>
      )}
    </span>
  )
}
