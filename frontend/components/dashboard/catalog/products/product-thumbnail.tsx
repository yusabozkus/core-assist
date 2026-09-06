"use client"

import { useState } from "react"
import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"

type ProductThumbnailProps = {
  title: string
  imageUrl: string | null
  className?: string
  imageClassName?: string
  sizes?: string
}

export function ProductThumbnail({
  title,
  imageUrl,
  className,
  imageClassName,
  sizes = "96px",
}: ProductThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const supportedImageUrl =
    imageUrl?.startsWith("/") || imageUrl?.startsWith("https://")

  return (
    <span
      className={cn(
        "relative block h-28 w-22 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:h-30 sm:w-24",
        className
      )}
    >
      {imageUrl && supportedImageUrl && imageUrl !== failedUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes={sizes}
          className={cn(
            "object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]",
            imageClassName
          )}
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-6" />
          <span className="text-[10px] font-medium">Görsel yok</span>
        </span>
      )}
    </span>
  )
}
