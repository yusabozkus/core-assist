import Link from "next/link"
import type { MouseEventHandler } from "react"
import { Layers01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import Image from "next/image"

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
      aria-label="Core Asistan ana sayfa"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#245d46]/30",
        className
      )}
    >
      <div className="flex flex-row items-center justify-center gap-4">
        {/* <Image
          src={'/logo/icon.png'}
          alt="Core Asistan Logo"
          width={40}
          height={40}
        /> */}
        <Image
          src={'/logo/text.png'}
          alt="Core Asistan Logo"
          height={0}
          width={160}
        />
      </div>
    </Link>
  )
}
