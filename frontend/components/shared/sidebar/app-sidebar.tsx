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
  const isOverviewActive = pathname === overview.url

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
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={overview.title}
                isActive={isOverviewActive}
              >
                <Link
                  href={overview.url}
                  aria-current={isOverviewActive ? "page" : undefined}
                >
                  <HugeiconsIcon icon={overview.icon} />
                  <span>{overview.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
                        <HugeiconsIcon icon={item.icon} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
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
            <HugeiconsIcon icon={item.icon} />
            <span>{item.title}</span>
            <HugeiconsIcon
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
