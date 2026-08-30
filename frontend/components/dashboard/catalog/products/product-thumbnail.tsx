"use client"

import { useState } from "react"
import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { CatalogProduct } from "@/types/product"

export function ProductThumbnail({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = product.images[0]?.url
  const supportedImageUrl =
    imageUrl?.startsWith("/") || imageUrl?.startsWith("https://")

  return (
    <div className="relative size-18 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-20">
      {imageUrl && supportedImageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={product.title}
          fill
          sizes="(max-width: 639px) 72px, 80px"
          className="object-cover transition-transform duration-300 hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/45 text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-7" />
          <span className="text-[10px] font-medium">Görsel yok</span>
        </div>
      )}
      {product.images.length > 1 ? (
        <span className="absolute right-2 bottom-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          +{product.images.length - 1}
        </span>
      ) : null}
    </div>
  )
}
