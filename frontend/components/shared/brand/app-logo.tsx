import Link from "next/link"
import { Layers01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

export function AppLogo({
  href = APP_ROUTES.dashboard.root,
  className,
}: {
  href?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-label="CoreAssist ana sayfa"
      className={cn(
        "group inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
        className
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/15 transition-transform group-hover:-translate-y-0.5">
        <HugeiconsIcon icon={Layers01Icon} className="size-4.5" />
      </span>
      <span>
        <span className="block text-[15px] leading-none font-bold tracking-[-0.025em] text-foreground">
          CoreAssist
        </span>
        <span className="mt-1 block text-[9px] leading-none font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          Commerce operations
        </span>
      </span>
    </Link>
  )
}
