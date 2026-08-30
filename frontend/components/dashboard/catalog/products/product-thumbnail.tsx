"use client"

import { useState } from "react"
import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

type ProductThumbnailProps = {
  title: string
  imageUrl: string | null
}

export function ProductThumbnail({ title, imageUrl }: ProductThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const supportedImageUrl =
    imageUrl?.startsWith("/") || imageUrl?.startsWith("https://")

  return (
    <div className="relative h-28 w-22 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:h-30 sm:w-24">
      {imageUrl && supportedImageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="96px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/45 text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-6" />
          <span className="text-[10px] font-medium">Görsel yok</span>
        </div>
      )}
    </div>
  )
}
