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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  APP_ROUTES,
  DASHBOARD_NAVIGATION,
  MOBILE_DASHBOARD_TABS,
  type DashboardNavigationItem,
} from "@/constants/site"
import { isPathActive } from "@/lib/utils"
import { ShopSwitcher, type SidebarShop } from "./shop-switcher"
import { SidebarUser, type SidebarUserData } from "./sidebar-user"
import { SidebarUsageAlert } from "./sidebar-usage-alert"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: SidebarUserData
  shops: SidebarShop[]
  activeShopId: string | null
  canManageBilling: boolean
}

const mobileTabRoutes = new Set<string>(
  MOBILE_DASHBOARD_TABS.map((tab) => tab.href)
)

function isMobileOnlyTab(url: string) {
  return url !== APP_ROUTES.dashboard.root && mobileTabRoutes.has(url)
}

export function AppSidebar({
  user,
  shops,
  activeShopId,
  canManageBilling,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const closeMobileMenu = () => setOpenMobile(false)
  const overview = DASHBOARD_NAVIGATION.overview
  const primaryItems = [overview, ...DASHBOARD_NAVIGATION.primaryItems]
  const activeShop = shops.find((shop) => shop.id === activeShopId)
  const isStoreArchived = activeShop?.status === "INACTIVE"
  const footerItems = DASHBOARD_NAVIGATION.footerItems.filter(
    (item) => item.url !== APP_ROUTES.dashboard.team || canManageBilling
  )
  const settingsItem = [
    ...DASHBOARD_NAVIGATION.footerItems,
    ...DASHBOARD_NAVIGATION.navGroups.flatMap((group) => group.items),
  ].find((item) => item.url === APP_ROUTES.dashboard.settings.root)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ShopSwitcher
          key={activeShopId ?? "no-active-store"}
          shops={shops}
          activeShopId={activeShopId}
          canManageStores={canManageBilling}
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
                      onClick={closeMobileMenu}
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
            <SidebarGroup
              className={
                primaryItems.every((item) => isMobileOnlyTab(item.url))
                  ? "hidden md:flex"
                  : undefined
              }
            >
              <SidebarMenu>
                {primaryItems.map((item) => {
                  const isActive =
                    item.url === APP_ROUTES.dashboard.root
                      ? pathname === item.url
                      : isPathActive(pathname, item.url)

                  return (
                    <SidebarMenuItem
                      key={item.url}
                      className={
                        isMobileOnlyTab(item.url)
                          ? "hidden md:block"
                          : undefined
                      }
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        <Link
                          href={item.url}
                          onClick={closeMobileMenu}
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

            {DASHBOARD_NAVIGATION.navGroups.map((group) => (
              <SidebarGroup
                key={group.label}
                className={
                  group.items.every((item) => isMobileOnlyTab(item.url))
                    ? "hidden md:flex"
                    : undefined
                }
              >
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      isPathActive(pathname, item.url, item.exact) ||
                      Boolean(
                        item.items?.some((subItem) =>
                          isPathActive(pathname, subItem.url, subItem.exact)
                        )
                      )

                    if (item.items) {
                      return (
                        <React.Fragment key={`${item.title}-${pathname}`}>
                          {item.items.map((subItem) => {
                            const isSubItemActive = isPathActive(
                              pathname,
                              subItem.url,
                              subItem.exact
                            )

                            return (
                              <SidebarMenuItem
                                key={subItem.url}
                                className="md:hidden"
                              >
                                <SidebarMenuButton
                                  asChild
                                  tooltip={subItem.title}
                                  isActive={isSubItemActive}
                                >
                                  <Link
                                    href={subItem.url}
                                    onClick={closeMobileMenu}
                                    aria-current={
                                      isSubItemActive ? "page" : undefined
                                    }
                                  >
                                    <HugeiconsIcon
                                      strokeWidth={2}
                                      icon={subItem.icon ?? item.icon}
                                    />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            )
                          })}
                          <CollapsibleNavigationItem
                            item={item}
                            pathname={pathname}
                            isActive={isActive}
                            onNavigate={closeMobileMenu}
                          />
                        </React.Fragment>
                      )
                    }

                    return (
                      <SidebarMenuItem
                        key={item.title}
                        className={
                          isMobileOnlyTab(item.url)
                            ? "hidden md:block"
                            : undefined
                        }
                      >
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={isActive}
                        >
                          <Link
                            href={item.url}
                            onClick={closeMobileMenu}
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
        {!isStoreArchived ? <SidebarUsageAlert /> : null}
        {!isStoreArchived ? (
          <SidebarMenu>
            {footerItems.map((item) => {
              const isActive = isPathActive(pathname, item.url, item.exact)

              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    <Link
                      href={item.url}
                      onClick={closeMobileMenu}
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
        <SidebarUser user={user} canManageBilling={canManageBilling} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function CollapsibleNavigationItem({
  item,
  pathname,
  isActive,
  onNavigate,
}: {
  item: DashboardNavigationItem
  pathname: string
  isActive: boolean
  onNavigate: () => void
}) {
  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem className="hidden md:block">
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
                      onClick={onNavigate}
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
