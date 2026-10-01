"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { MOBILE_DASHBOARD_TABS } from "@/constants/site"
import { canAccessDashboardPage } from "@/lib/dashboard-access"
import { cn } from "@/lib/utils"
import type { StoreAccessLevel } from "@/types/store"

export function MobileBottomNavigation({
  accessLevel,
}: {
  accessLevel?: StoreAccessLevel
}) {
  const pathname = usePathname()
  const tabs = MOBILE_DASHBOARD_TABS.filter((tab) =>
    canAccessDashboardPage(tab.href, accessLevel)
  )

  if (!tabs.some((tab) => tab.href === pathname)) {
    return null
  }

  return (
    <nav
      aria-label="Mobil ana gezinme"
      className="z-30 shrink-0 border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div
        className="grid h-16"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isActive && "font-semibold text-primary"
              )}
            >
              <HugeiconsIcon
                icon={tab.icon}
                strokeWidth={isActive ? 2.2 : 1.8}
                className="size-5"
              />
              <span className="truncate text-[11px] leading-none">
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
