"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  APP_ROUTES,
  DASHBOARD_NAVIGATION,
  type DashboardNavigationItem,
} from "@/constants/site"
import { isPathActive } from "@/lib/utils"
import { ShopSwitcher, type SidebarShop } from "./shop-switcher"
import { SidebarUser, type SidebarUserData } from "./sidebar-user"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: SidebarUserData
  shops: SidebarShop[]
  activeShopId: string
}

export function AppSidebar({
  user,
  shops,
  activeShopId,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const overview = DASHBOARD_NAVIGATION.overview
  const primaryItems = [overview, ...DASHBOARD_NAVIGATION.primaryItems]
  const activeShop = shops.find((shop) => shop.id === activeShopId)
  const isStoreArchived = activeShop?.status === "INACTIVE"
  const settingsItem = DASHBOARD_NAVIGATION.navGroups
    .flatMap((group) => group.items)
    .find((item) => item.url === APP_ROUTES.dashboard.settings.root)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ShopSwitcher
          key={activeShopId}
          shops={shops}
          activeShopId={activeShopId}
        />
      </SidebarHeader>

      <SidebarContent>
        {isStoreArchived ? (
          <SidebarGroup>
            <SidebarGroupLabel>Arşivlenmiş mağaza</SidebarGroupLabel>
            <SidebarMenu>
              {settingsItem ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={settingsItem.title}
                    isActive={pathname === settingsItem.url}
                  >
                    <Link
                      href={settingsItem.url}
                      aria-current={
                        pathname === settingsItem.url ? "page" : undefined
                      }
                    >
                      <HugeiconsIcon strokeWidth={2} icon={settingsItem.icon} />
                      <span>{settingsItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarMenu>
                {primaryItems.map((item) => {
                  const isActive =
                    item.url === APP_ROUTES.dashboard.root
                      ? pathname === item.url
                      : isPathActive(pathname, item.url)

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        <Link
                          href={item.url}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <HugeiconsIcon icon={item.icon} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>

            {DASHBOARD_NAVIGATION.navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      isPathActive(pathname, item.url) ||
                      Boolean(
                        item.items?.some((subItem) =>
                          isPathActive(pathname, subItem.url, subItem.exact)
                        )
                      )

                    if (item.items) {
                      return (
                        <CollapsibleNavigationItem
                          key={`${item.title}-${pathname}`}
                          item={item}
                          pathname={pathname}
                          isActive={isActive}
                        />
                      )
                    }

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={isActive}
                        >
                          <Link
                            href={item.url}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <HugeiconsIcon strokeWidth={2} icon={item.icon} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {!isStoreArchived ? (
          <SidebarMenu>
            {DASHBOARD_NAVIGATION.footerItems.map((item) => {
              const isActive = isPathActive(pathname, item.url)

              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    <Link
                      href={item.url}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        ) : null}
        <SidebarUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function CollapsibleNavigationItem({
  item,
  pathname,
  isActive,
}: {
  item: DashboardNavigationItem
  pathname: string
  isActive: boolean
}) {
  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive}>
            <HugeiconsIcon strokeWidth={2} icon={item.icon} />
            <span>{item.title}</span>
            <HugeiconsIcon
              strokeWidth={2}
              icon={ChevronRightIcon}
              className="ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-90"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => {
              const isSubItemActive = isPathActive(
                pathname,
                subItem.url,
                subItem.exact
              )

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                    <Link
                      href={subItem.url}
                      aria-current={isSubItemActive ? "page" : undefined}
                    >
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
