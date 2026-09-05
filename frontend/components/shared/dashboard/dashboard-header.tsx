"use client"

import {
  ChevronRightIcon,
  Notification01Icon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APP_ROUTES, getDashboardBreadcrumbs } from "@/constants/site"
import { GlobalSearch } from "@/components/shared/dashboard/global-search"
import { getChannelConnections } from "@/lib/api/channels"
import {
  getDashboardSyncState,
  type DashboardSyncState,
} from "@/lib/channels/sync-state"

type DashboardHeaderProps = {
  storeId: string
  syncState: DashboardSyncState
  isStoreArchived?: boolean
}

const SYNC_STATE_DETAILS: Record<
  DashboardSyncState,
  { label: string; indicatorClassName: string }
> = {
  current: {
    label: "Senkronizasyon güncel",
    indicatorClassName: "bg-emerald-500",
  },
  error: {
    label: "Senkronizasyon hatası",
    indicatorClassName: "bg-destructive",
  },
  idle: {
    label: "Bağlı kanal yok",
    indicatorClassName: "bg-muted-foreground/45",
  },
  pending: {
    label: "İlk senkronizasyon bekleniyor",
    indicatorClassName: "bg-amber-500",
  },
  syncing: {
    label: "Senkronize ediliyor",
    indicatorClassName: "animate-pulse bg-sky-500",
  },
  unavailable: {
    label: "Senkronizasyon durumu alınamadı",
    indicatorClassName: "bg-muted-foreground/45",
  },
}

export function DashboardHeader({
  storeId,
  syncState,
  isStoreArchived = false,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const breadcrumbs = getDashboardBreadcrumbs(pathname)
  const currentPage = breadcrumbs.at(-1)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [liveSyncState, setLiveSyncState] = useState(syncState)

  useEffect(() => {
    setLiveSyncState(syncState)
  }, [storeId, syncState])

  useEffect(() => {
    if (isStoreArchived) return

    let disposed = false
    let timeoutId: number | undefined
    let controller: AbortController | undefined

    async function refreshSyncState() {
      controller = new AbortController()

      try {
        const connections = await getChannelConnections(
          storeId,
          controller.signal
        )
        if (disposed) return

        const nextState = getDashboardSyncState(connections)
        setLiveSyncState(nextState)
        timeoutId = window.setTimeout(
          refreshSyncState,
          nextState === "syncing" || nextState === "pending" ? 2_500 : 20_000
        )
      } catch {
        if (disposed || controller.signal.aborted) return
        timeoutId = window.setTimeout(refreshSyncState, 10_000)
      }
    }

    void refreshSyncState()

    return () => {
      disposed = true
      controller?.abort()
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [isStoreArchived, pathname, storeId])

  useEffect(() => {
    if (isStoreArchived) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isStoreArchived])

  return (
    <>
      <header className="relative z-30 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger
                className="-ml-1 size-8.5 shrink-0 rounded-lg border border-border bg-card text-muted-foreground shadow-xs hover:border-foreground/15 hover:bg-muted hover:text-foreground [&_svg]:size-4"
                aria-label="Menüyü aç veya daralt"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Menüyü aç veya daralt
            </TooltipContent>
          </Tooltip>
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />

          <nav
            aria-label="Sayfa yolu"
            className="hidden min-w-0 items-center gap-1.5 sm:flex"
          >
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1

              return (
                <span
                  key={`${breadcrumb.url}-${breadcrumb.title}`}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  {index > 0 ? (
                    <HugeiconsIcon
                      icon={ChevronRightIcon}
                      className="size-3.5 shrink-0 text-muted-foreground/45"
                    />
                  ) : null}
                  {isCurrent ? (
                    <span className="truncate text-sm font-semibold text-foreground">
                      {breadcrumb.title}
                    </span>
                  ) : (
                    <Link
                      href={breadcrumb.url}
                      className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {breadcrumb.title}
                    </Link>
                  )}
                </span>
              )
            })}
          </nav>

          <span className="truncate text-sm font-semibold text-foreground sm:hidden">
            {currentPage?.title ?? "Dashboard"}
          </span>
        </div>

        {isStoreArchived ? (
          <Badge
            variant="warning"
            className="hidden justify-self-center lg:flex"
          >
            <span className="size-1.5 rounded-full bg-current" />
            Arşivlenmiş mağaza
          </Badge>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="hidden h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-foreground/15 hover:bg-muted/55 lg:flex dark:hover:border-foreground/20 dark:hover:bg-secondary"
            aria-label="Genel aramayı aç"
          >
            <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Her yerde ara...</span>
            <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] leading-none text-muted-foreground shadow-xs">
              Ctrl K
            </kbd>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1.5 justify-self-end">
          {isStoreArchived ? (
            <Badge variant="warning" className="lg:hidden">
              Arşivlenmiş
            </Badge>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="bg-card shadow-xs lg:hidden"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Genel aramayı aç"
              >
                <HugeiconsIcon icon={Search01Icon} className="size-4" />
              </Button>

              <SyncStatusLink state={liveSyncState} />

              <Button
                asChild
                variant="outline"
                size="icon-sm"
                className="bg-card shadow-xs"
              >
                <Link
                  href={APP_ROUTES.dashboard.settings.notifications}
                  aria-label="Bildirimler"
                >
                  <HugeiconsIcon icon={Notification01Icon} className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {!isStoreArchived ? (
        <GlobalSearch
          storeId={storeId}
          open={isSearchOpen}
          onOpenChange={setIsSearchOpen}
        />
      ) : null}
    </>
  )
}

function SyncStatusLink({ state }: { state: DashboardSyncState }) {
  const details = SYNC_STATE_DETAILS[state]

  return (
    <Link
      href={APP_ROUTES.dashboard.channels.sync}
      aria-label={details.label}
      title={details.label}
      className="relative hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-muted-foreground shadow-xs transition-colors hover:border-foreground/15 hover:bg-muted/70 hover:text-foreground sm:flex xl:px-3"
    >
      <span className="relative">
        <HugeiconsIcon
          icon={RefreshIcon}
          className={`size-4 ${state === "syncing" ? "animate-spin" : ""}`}
        />
        <span
          className={`absolute -right-1 -bottom-0.5 size-2 rounded-full ring-2 ring-background ${details.indicatorClassName}`}
          aria-hidden="true"
        />
      </span>
      <span className="hidden xl:inline">{details.label}</span>
    </Link>
  )
}
