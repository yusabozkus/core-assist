"use client"

import { useState } from "react"
import Image from "next/image"
import { Image01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LandingScreenshot } from "@/constants/landing-screenshots"
import { cn } from "@/lib/utils"

export function AppScreenshot({
  screenshot,
  className,
  showCaption = true,
  onReady,
  sizes = "(max-width: 768px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 64px), 1180px",
}: {
  screenshot: LandingScreenshot
  className?: string
  showCaption?: boolean
  onReady?: (src: string) => void
  sizes?: string
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="overflow-hidden rounded-2xl border border-[#cad4c5] bg-white shadow-[0_20px_60px_-35px_rgba(23,40,31,0.3)] sm:rounded-[22px]">
        <div className="flex h-10 items-center gap-4 border-b border-[#e1e6dc] bg-[#f5f7f1] px-4 sm:h-12 sm:px-5">
          <div aria-hidden="true" className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#c7d0c1] sm:size-2" />
            <span className="size-1.5 rounded-full bg-[#c7d0c1] sm:size-2" />
            <span className="size-1.5 rounded-full bg-[#c7d0c1] sm:size-2" />
          </div>
          <span className="h-3 w-px bg-[#d7dfd1]" aria-hidden="true" />
          <p className="flex min-w-0 items-center gap-2 truncate text-[10px] text-[#77846e] sm:text-[11px]">
            <span className="font-semibold text-[#47563e]">CoreAssist</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{screenshot.label}</span>
          </p>
          <span
            aria-hidden="true"
            className="ml-auto hidden h-2 w-8 rounded-full border border-[#d5dece] sm:block"
          />
        </div>
        <ScreenshotImage
          key={screenshot.src}
          screenshot={screenshot}
          sizes={sizes}
          onReady={onReady}
        />
      </div>
      {showCaption && (
        <figcaption className="mt-5 grid gap-2 px-1 sm:grid-cols-[1fr_1.1fr] sm:gap-10">
          <p className="text-sm font-medium tracking-[-0.015em] text-[#273b29] sm:text-base">
            {screenshot.title}
          </p>
          <p className="max-w-xl text-xs leading-5 text-[#78816f] sm:text-[13px] sm:leading-6">
            {screenshot.description}
          </p>
        </figcaption>
      )}
    </figure>
  )
}

function ScreenshotImage({
  screenshot,
  sizes,
  onReady,
}: {
  screenshot: LandingScreenshot
  sizes: string
  onReady?: (src: string) => void
}) {
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  )
  const isReady = imageStatus === "ready"

  return (
    <div className="relative aspect-[8/5] overflow-hidden bg-[#edf1e7]">
      <div
        aria-hidden={isReady}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center motion-safe:transition-opacity motion-safe:duration-300 sm:gap-4",
          isReady && "pointer-events-none opacity-0"
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-4 rounded-lg border border-dashed border-[#ccd6c3] sm:inset-7 sm:rounded-xl"
        />
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-xl border border-[#d4dec9] bg-[#f5f7f1] text-[#7e946f] sm:size-14 sm:rounded-2xl"
        >
          <HugeiconsIcon icon={Image01Icon} className="size-5 sm:size-6" />
        </span>
        <div className="relative max-w-sm">
          <p className="text-sm font-medium tracking-[-0.02em] text-[#617552] sm:text-lg">
            {screenshot.label}
          </p>
          <p className="mt-1.5 text-[10px] leading-5 text-[#8a987c] sm:text-xs">
            Ekran görüntüsü alanı
          </p>
        </div>
      </div>
      {screenshot.available && imageStatus !== "error" && (
        <Image
          src={screenshot.src}
          alt={screenshot.alt}
          fill
          unoptimized
          sizes={sizes}
          loading="lazy"
          className={cn(
            "object-contain object-top motion-safe:transition-opacity motion-safe:duration-300",
            isReady ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => {
            setImageStatus("ready")
            onReady?.(screenshot.src)
          }}
          onError={() => {
            setImageStatus("error")
            onReady?.(screenshot.src)
          }}
        />
      )}
    </div>
  )
}
