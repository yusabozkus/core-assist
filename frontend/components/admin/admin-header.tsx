"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  CustomerSupportIcon,
  MultiplicationSignCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { AdminGlobalSearch } from "@/components/admin/admin-global-search"
import { NotificationCenter } from "@/components/shared/dashboard/notification-center"
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
  const previousHealthRef = useRef({
    status: initialSummary.systemStatus,
    issues: initialSummary.systemIssues,
    checkedAt: initialSummary.checkedAt,
  })

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

  useEffect(() => {
    const previous = previousHealthRef.current
    if (previous.checkedAt === summary.checkedAt) return

    const healthWorsened =
      healthSeverity(summary.systemStatus) > healthSeverity(previous.status)
    const issueCountIncreased = summary.systemIssues > previous.issues
    const alertStatus =
      summary.systemStatus === "HEALTHY" ? null : summary.systemStatus

    previousHealthRef.current = {
      status: summary.systemStatus,
      issues: summary.systemIssues,
      checkedAt: summary.checkedAt,
    }

    if (alertStatus && (healthWorsened || issueCountIncreased)) {
      const toastId = toast.custom(
        (id) => (
          <AdminSystemAlert
            status={alertStatus}
            issueCount={summary.systemIssues}
            onDismiss={() => toast.dismiss(id)}
          />
        ),
        { duration: 6_000, position: "top-center" }
      )

      return () => {
        toast.dismiss(toastId)
      }
    }
  }, [summary])

  if (isSupportTicketDetail) return null

  return (
    <header className="relative z-30 grid h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/92 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 items-center md:w-[clamp(10rem,18vw,17rem)]">
        <SidebarTrigger
          className="-ml-1 size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-label="Menüyü aç veya daralt"
        />
        <span aria-hidden="true" className="mx-3 h-4 w-px shrink-0 bg-border" />
        <p className="truncate text-sm font-semibold tracking-[-0.01em]">
          {currentItem?.title ?? "Yönetim paneli"}
        </p>
      </div>

      <div className="hidden min-w-0 justify-center md:flex">
        <AdminGlobalSearch className="h-8 w-full max-w-sm rounded-lg text-xs shadow-none" />
      </div>

      <div className="ml-auto flex min-w-0 items-center justify-end">
        <div className="md:hidden">
          <AdminGlobalSearch className="size-9 justify-center px-0 [&>kbd]:hidden [&>span]:hidden" />
        </div>
        <nav
          aria-label="Yönetim durumu"
          className="hidden items-center divide-x divide-border/60 sm:flex"
        >
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
          <AdminSystemHealthMetric
            status={summary.systemStatus}
            issueCount={summary.systemIssues}
          />
        </nav>
        <span
          aria-hidden="true"
          className="mx-1.5 hidden h-4 w-px bg-border sm:block"
        />
        <NotificationCenter scope="admin" />
      </div>
    </header>
  )
}

function AdminSystemHealthMetric({
  status,
  issueCount,
}: {
  status: AdminHeaderSummary["systemStatus"]
  issueCount: number
}) {
  const details = systemHealthDetails(status)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={APP_ROUTES.admin.system}
          aria-label={`${details.label}: ${issueCount} aktif sorun`}
          className={cn(
            "group flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            status === "HEALTHY" &&
              "text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300",
            status === "DEGRADED" &&
              "text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300",
            status === "DOWN" && "text-destructive hover:text-destructive/80"
          )}
        >
          <HugeiconsIcon
            icon={details.icon}
            strokeWidth={2}
            className="size-4"
          />
          <span className="hidden whitespace-nowrap xl:inline">Sistem</span>
          {status !== "HEALTHY" ? (
            <span className="min-w-3 text-center font-semibold tabular-nums">
              {issueCount}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={7}>
        {details.description}
      </TooltipContent>
    </Tooltip>
  )
}

function AdminSystemAlert({
  status,
  issueCount,
  onDismiss,
}: {
  status: Exclude<AdminHeaderSummary["systemStatus"], "HEALTHY">
  issueCount: number
  onDismiss: () => void
}) {
  const isDown = status === "DOWN"

  return (
    <article
      className={cn(
        "relative w-[min(29rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-popover/96 text-popover-foreground shadow-[0_18px_55px_-22px_rgba(15,23,42,0.4)] backdrop-blur-xl",
        isDown ? "border-destructive/30" : "border-amber-500/30"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          isDown ? "bg-destructive" : "bg-amber-500"
        )}
      />
      <div className="flex items-start gap-3 p-4">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
            isDown
              ? "bg-destructive/10 text-destructive"
              : "bg-amber-500/12 text-amber-700 dark:text-amber-400"
          )}
        >
          <HugeiconsIcon
            icon={isDown ? MultiplicationSignCircleIcon : Alert02Icon}
            strokeWidth={2}
            className="size-4.5"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Sistem sağlığı
          </p>
          <p className="mt-1.5 text-sm leading-5 font-semibold text-foreground">
            {isDown
              ? "Kritik bir servis erişilemiyor"
              : "Yeni bir operasyon sorunu algılandı"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {issueCount > 0
              ? `${issueCount} aktif sinyal incelenmeyi bekliyor.`
              : "Servislerden biri sağlık kontrolüne yanıt vermiyor."}
          </p>
          <Link
            href={APP_ROUTES.admin.system}
            onClick={onDismiss}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-foreground/80 hover:text-foreground"
          >
            Sistem sağlığını incele
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </Link>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Uyarıyı kapat"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </article>
  )
}

function healthSeverity(status: AdminHeaderSummary["systemStatus"]) {
  return { HEALTHY: 0, DEGRADED: 1, DOWN: 2 }[status]
}

function systemHealthDetails(status: AdminHeaderSummary["systemStatus"]) {
  if (status === "DOWN") {
    return {
      label: "Sistem erişilemiyor",
      description: "Kritik servislerden biri erişilemiyor",
      icon: MultiplicationSignCircleIcon,
    }
  }
  if (status === "DEGRADED") {
    return {
      label: "Sistem dikkat gerektiriyor",
      description: "İncelenmesi gereken operasyon sorunları var",
      icon: Alert02Icon,
    }
  }
  return {
    label: "Sistem sağlıklı",
    description: "Kritik servisler normal çalışıyor",
    icon: CheckmarkCircle02Icon,
  }
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
            "group flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            tone === "neutral" && "text-muted-foreground hover:text-foreground",
            tone === "primary" && "text-primary hover:text-primary/80",
            tone === "danger" && "text-destructive hover:text-destructive/80"
          )}
        >
          <HugeiconsIcon
            icon={icon}
            strokeWidth={2}
            className={cn("size-4 shrink-0", animateIcon && "animate-spin")}
          />
          <span className="hidden whitespace-nowrap xl:inline">{label}</span>
          <span className="min-w-3 text-center font-semibold tabular-nums">
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
