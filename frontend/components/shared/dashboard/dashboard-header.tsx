"use client"

import {
  ChevronRightIcon,
  InboxIcon,
  Notification01Icon,
  Package01Icon,
  RefreshIcon,
  Search01Icon,
  ShoppingBag01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APP_ROUTES, getDashboardBreadcrumbs } from "@/constants/site"

export type DashboardSyncState =
  "current" | "error" | "idle" | "pending" | "syncing" | "unavailable"

type DashboardHeaderProps = {
  syncState: DashboardSyncState
  isStoreArchived?: boolean
}

const SEARCH_SCOPES = [
  {
    label: "Ürünlerde ara",
    description: "Ürün adı, SKU veya barkod",
    icon: Package01Icon,
  },
  {
    label: "Siparişlerde ara",
    description: "Sipariş numarası veya müşteri",
    icon: ShoppingBag01Icon,
  },
  {
    label: "Müşterilerde ara",
    description: "Ad, telefon veya e-posta",
    icon: UserGroupIcon,
  },
  {
    label: "Mesajlarda ara",
    description: "Konuşma veya kanal",
    icon: InboxIcon,
  },
] as const

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
  syncState,
  isStoreArchived = false,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const breadcrumbs = getDashboardBreadcrumbs(pathname)
  const currentPage = breadcrumbs.at(-1)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

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

              <SyncStatusLink state={syncState} />

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
        <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
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

function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Genel arama"
      description="Ürün, sipariş, müşteri ve konuşmalar arasında arama yapın."
      contentClassName="sm:max-w-xl"
      bodyClassName="p-0"
    >
      <Command className="rounded-none bg-transparent p-0">
        <CommandInput placeholder="Aramak istediğiniz şeyi yazın..." />
        <CommandList className="max-h-[min(22rem,48svh)] px-1 pb-2">
          <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
          <CommandGroup heading="Arama alanları">
            {SEARCH_SCOPES.map((scope) => (
              <CommandItem
                key={scope.label}
                value={`${scope.label} ${scope.description}`}
                onSelect={() => undefined}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={scope.icon} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{scope.label}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {scope.description}
                  </span>
                </span>
                <CommandShortcut>Yakında</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsiveDialog>
  )
}
