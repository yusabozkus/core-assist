"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpDownIcon,
  CheckmarkCircle01Icon,
  PlusSignIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

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
import { APP_ROUTES } from "@/constants/site"
import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import type { StoreSummary } from "@/types/store"

export type SidebarShop = StoreSummary

export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: SidebarShop[]
  activeShopId: string
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [selectedShopId, setSelectedShopId] = React.useState(activeShopId)
  const [selectionError, setSelectionError] = React.useState<string | null>(
    null
  )
  const [isPending, startTransition] = React.useTransition()
  const activeShop =
    shops.find((shop) => shop.id === selectedShopId) ?? shops[0]

  function handleShopChange(shop: SidebarShop) {
    if (shop.id === selectedShopId || isPending) return

    const previousShopId = selectedShopId
    setSelectedShopId(shop.id)
    setSelectionError(null)

    startTransition(async () => {
      try {
        await selectActiveStore(shop.id)
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
                  {isPending ? "Değiştiriliyor..." : "Aktif mağaza"}
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
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Mağazalar
            </DropdownMenuLabel>
            {shops.map((shop) => (
              <DropdownMenuItem
                key={shop.id}
                onClick={() => handleShopChange(shop)}
                className="gap-2 p-2"
              >
                <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                  <HugeiconsIcon icon={Store01Icon} className="size-3.5" />
                </div>
                <div className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {shop.id === selectedShopId ? "Şu anda aktif" : "Geçiş yap"}
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
            <DropdownMenuItem asChild>
              <Link
                href={APP_ROUTES.dashboard.settings.stores}
                className="gap-2 p-2"
              >
                <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                </div>
                <span>Mağaza ekle veya yönet</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
