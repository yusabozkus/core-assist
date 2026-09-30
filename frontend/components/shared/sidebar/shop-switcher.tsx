"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpDownIcon,
  ArrowUpRight01Icon,
  CheckmarkCircle01Icon,
  PlusSignIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { APP_ROUTES } from "@/constants/site"
import { getTeamAccessLabel } from "@/lib/team"
import type { StoreSummary } from "@/types/store"

export type SidebarShop = StoreSummary

export function ShopSwitcher({
  shops,
  activeShopId,
  canManageStores,
}: {
  shops: SidebarShop[]
  activeShopId: string | null
  canManageStores: boolean
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const { usage } = useBillingUsage()
  const mayManageStore = usage?.canManageBilling ?? canManageStores
  const storeCapacity = usage?.capacity?.stores
  const isStoreLimitReached = Boolean(
    storeCapacity && storeCapacity.used >= storeCapacity.limit
  )
  const [selectedShopId, setSelectedShopId] = React.useState(activeShopId ?? "")
  const [selectionError, setSelectionError] = React.useState<string | null>(
    null
  )
  const [isPending, startTransition] = React.useTransition()
  const activeShop =
    shops.find((shop) => shop.id === selectedShopId) ?? shops[0]

  function handleShopChange(shop: SidebarShop) {
    if (isPending) return
    if (
      mayManageStore &&
      shop.status === "ACTIVE" &&
      shop.setupComplete === false
    ) {
      router.push(
        `${APP_ROUTES.storeOnboarding}?storeId=${encodeURIComponent(shop.id)}`
      )
      return
    }
    if (shop.id === selectedShopId) return

    const previousShopId = selectedShopId
    setSelectedShopId(shop.id)
    setSelectionError(null)

    startTransition(async () => {
      try {
        await selectActiveStore(shop.id)
        if (shop.status === "INACTIVE") {
          router.replace(APP_ROUTES.dashboard.settings.root)
        }
        router.refresh()
      } catch {
        setSelectedShopId(previousShopId)
        setSelectionError("Mağaza değiştirilemedi.")
      }
    })
  }

  if (!activeShop) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HugeiconsIcon icon={Store01Icon} className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeShop.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {isPending
                    ? "Değiştiriliyor..."
                    : activeShop.accessLevel
                      ? getTeamAccessLabel(activeShop.accessLevel)
                      : "Ekip üyesi"}
                </span>
              </div>
              <HugeiconsIcon
                icon={ArrowUpDownIcon}
                className="ml-auto size-4"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={6}
          >
            <DropdownMenuLabel className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Mağazalar</span>
              {storeCapacity ? (
                <span
                  className="font-medium tabular-nums"
                  aria-label={`${storeCapacity.used} / ${storeCapacity.limit} mağaza`}
                >
                  {storeCapacity.used}/{storeCapacity.limit}
                </span>
              ) : null}
            </DropdownMenuLabel>
            {shops.map((shop) => (
              <DropdownMenuItem
                key={shop.id}
                onClick={() => handleShopChange(shop)}
                className="gap-2 p-2"
              >
                <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                  <HugeiconsIcon
                    icon={Store01Icon}
                    className={`size-3.5 ${shop.status === "INACTIVE" ? "text-muted-foreground" : ""}`}
                  />
                </div>
                <div className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {shop.status === "INACTIVE"
                      ? "Arşivlenmiş"
                      : shop.setupComplete === false
                          ? mayManageStore
                          ? "Kuruluma devam et"
                          : "Kurulum sürüyor"
                        : shop.id === selectedShopId
                          ? "Şu anda aktif"
                          : "Geçiş yap"}
                  </span>
                </div>
                {shop.id === selectedShopId ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="ml-auto size-4 text-primary"
                  />
                ) : null}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            {selectionError ? (
              <p className="px-2 py-1 text-xs text-destructive" role="alert">
                {selectionError}
              </p>
            ) : null}
              {!mayManageStore ? (
              <DropdownMenuItem disabled className="gap-2 p-2">
                <span>
                  {isStoreLimitReached
                    ? "Mağaza limiti dolu · yöneticinize başvurun"
                    : "Mağaza eklemek için yönetici yetkisi gerekir"}
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild className="gap-2 p-2">
                <Link
                  href={
                    isStoreLimitReached
                      ? APP_ROUTES.dashboard.settings.plans
                      : APP_ROUTES.storeOnboarding
                  }
                >
                  <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                      <HugeiconsIcon
                        icon={isStoreLimitReached ? ArrowUpRight01Icon : PlusSignIcon}
                        className="size-3.5"
                      />
                  </div>
                  <span>
                    {isStoreLimitReached ? "Planı yükselt" : "Mağaza ekle"}
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
