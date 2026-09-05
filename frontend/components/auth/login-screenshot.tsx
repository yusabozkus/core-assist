"use client"

import { useState } from "react"
import Image from "next/image"
import { Image01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LandingScreenshot } from "@/constants/landing-screenshots"
import { cn } from "@/lib/utils"

export function LoginScreenshot({
  screenshot,
}: {
  screenshot: LandingScreenshot
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  return (
    <div className="relative aspect-[8/5] overflow-hidden bg-[#e9ede6]">
      <div
        aria-hidden={status === "ready"}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#66785c]",
          status === "ready" && "invisible"
        )}
      >
        <HugeiconsIcon icon={Image01Icon} className="size-7 opacity-50" />
        <span className="text-xs font-medium">{screenshot.label}</span>
        <span className="text-[11px] text-[#88967f]">
          Çalışma alanı önizlemesi
        </span>
      </div>
      {screenshot.available && status !== "error" && (
        <Image
          src={screenshot.src}
          alt={screenshot.alt}
          fill
          unoptimized
          sizes="(min-width: 1536px) 700px, (min-width: 1024px) 48vw, 0px"
          loading="lazy"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={cn(
            "object-contain object-top motion-safe:transition-opacity motion-safe:duration-300",
            status === "ready" ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  )
}
