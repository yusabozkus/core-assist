"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CreditCardIcon,
  CustomerSupportIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { AdminGlobalSearch } from "@/components/admin/admin-global-search"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getAdminNavigationItem } from "@/constants/admin"
import { APP_ROUTES } from "@/constants/site"
import { getAdminHeaderSummary } from "@/lib/api/admin"
import { cn } from "@/lib/utils"
import type { AdminHeaderSummary } from "@/types/admin"

const SUMMARY_REFRESH_INTERVAL_MS = 30_000

export function AdminHeader({
  initialSummary,
}: {
  initialSummary: AdminHeaderSummary
}) {
  const pathname = usePathname()
  const currentItem = getAdminNavigationItem(pathname)
  const isSupportTicketDetail = /^\/admin\/support\/[^/]+\/?$/.test(pathname)
  const [summary, setSummary] = useState(initialSummary)

  const refreshSummary = useCallback(async () => {
    if (document.visibilityState === "hidden") return

    try {
      setSummary(await getAdminHeaderSummary())
    } catch {
      // Keep the last successful snapshot during transient network failures.
    }
  }, [])

  useEffect(() => {
    if (isSupportTicketDetail) return

    const intervalId = window.setInterval(
      () => void refreshSummary(),
      SUMMARY_REFRESH_INTERVAL_MS
    )
    window.addEventListener("focus", refreshSummary)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshSummary)
    }
  }, [isSupportTicketDetail, refreshSummary])

  if (isSupportTicketDetail) return null

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/92 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 flex-1 items-center lg:max-w-68">
        <SidebarTrigger
          className="-ml-1 size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-label="Menüyü aç veya daralt"
        />
        <span
          aria-hidden="true"
          className="mx-3 h-4 w-px shrink-0 bg-border"
        />
        <p className="truncate text-sm font-semibold tracking-[-0.01em]">
          {currentItem?.title ?? "Yönetim paneli"}
        </p>
      </div>

      <div className="hidden min-w-60 flex-1 justify-center md:flex">
        <AdminGlobalSearch className="max-w-xl" />
      </div>

      <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 lg:max-w-md">
        <div className="md:hidden">
          <AdminGlobalSearch className="size-9 justify-center px-0 [&>kbd]:hidden [&>span]:hidden" />
        </div>
        <AdminHeaderMetric
          href={APP_ROUTES.admin.support}
          label="Açık destek"
          tooltip="Yanıt veya işlem bekleyen destek talepleri"
          count={summary.openSupportTickets}
          icon={CustomerSupportIcon}
          tone={summary.openSupportTickets > 0 ? "primary" : "neutral"}
        />
        <AdminHeaderMetric
          href={APP_ROUTES.admin.billing}
          label="Ödeme sorunu"
          tooltip="Ödemesi gecikmiş abonelikler"
          count={summary.paymentIssues}
          icon={CreditCardIcon}
          tone={summary.paymentIssues > 0 ? "danger" : "neutral"}
        />
        <AdminHeaderMetric
          href={APP_ROUTES.admin.operations}
          label="Aktif işlem"
          tooltip="Şu anda çalışan veya kuyrukta olan senkronizasyonlar"
          count={summary.activeSyncs}
          icon={RefreshIcon}
          tone={summary.activeSyncs > 0 ? "primary" : "neutral"}
          animateIcon={summary.activeSyncs > 0}
        />
      </div>
    </header>
  )
}

function AdminHeaderMetric({
  href,
  label,
  tooltip,
  count,
  icon,
  tone,
  animateIcon = false,
}: {
  href: string
  label: string
  tooltip: string
  count: number
  icon: IconSvgElement
  tone: "neutral" | "primary" | "danger"
  animateIcon?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={`${label}: ${count}`}
          className={cn(
            "flex h-9 min-w-9 items-center justify-center gap-2 rounded-xl border px-2.5 text-xs font-medium shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            tone === "neutral" &&
              "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            tone === "primary" &&
              "border-primary/20 bg-primary/8 text-primary hover:bg-primary/12",
            tone === "danger" &&
              "border-destructive/20 bg-destructive/8 text-destructive hover:bg-destructive/12"
          )}
        >
          <HugeiconsIcon
            icon={icon}
            strokeWidth={2}
            className={cn("size-4 shrink-0", animateIcon && "animate-spin")}
          />
          <span className="hidden 2xl:inline">{label}</span>
          <span className="min-w-4 text-center font-semibold tabular-nums">
            {count}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={7}>
        {tooltip}: {count}
      </TooltipContent>
    </Tooltip>
  )
}
