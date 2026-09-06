import Link from "next/link"
import type { MouseEventHandler } from "react"
import { Layers01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"

export function LandingBrand({
  compact = false,
  className,
  onClick,
}: {
  compact?: boolean
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <Link
      href="/"
      aria-label="CoreAssist ana sayfa"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#245d46]/30",
        className
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#173f31] text-white shadow-[0_6px_20px_rgba(23,63,49,0.18)]">
        <HugeiconsIcon icon={Layers01Icon} className="size-[17px]" />
      </span>
      <span
        className={cn(
          "text-[15px] font-bold tracking-[-0.035em] text-[#17201d]",
          compact && "hidden sm:inline"
        )}
      >
        CoreAssist
      </span>
    </Link>
  )
}
