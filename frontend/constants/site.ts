import {
  Analytics01Icon,
  CustomerSupportIcon,
  DashboardSquare01Icon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  Settings02Icon,
  ShoppingBag01Icon,
  UserGroupIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  onboarding: "/onboarding",
  dashboard: {
    root: "/dashboard",
    inbox: "/dashboard/inbox",
    orders: {
      root: "/dashboard/orders",
      returns: "/dashboard/orders/returns",
    },
    catalog: {
      root: "/dashboard/catalog",
      products: "/dashboard/catalog/products",
      inventory: "/dashboard/catalog/inventory",
    },
    customers: "/dashboard/customers",
    channels: {
      root: "/dashboard/channels",
      sync: "/dashboard/channels/sync",
    },
    automations: "/dashboard/automations",
    analytics: "/dashboard/analytics",
    team: "/dashboard/team",
    support: "/dashboard/support",
    settings: {
      root: "/dashboard/settings",
      profile: "/dashboard/settings/profile",
      notifications: "/dashboard/settings/notifications",
      billing: "/dashboard/settings/billing",
    },
  },
} as const

export type DashboardNavigationSubItem = Readonly<{
  title: string
  url: string
  exact?: boolean
}>

export type DashboardNavigationItem = Readonly<{
  title: string
  url: string
  icon: IconSvgElement
  items?: ReadonlyArray<DashboardNavigationSubItem>
}>

export type DashboardBreadcrumb = Readonly<{
  title: string
  url: string
}>

type DashboardNavigation = Readonly<{
  overview: DashboardNavigationItem
  primaryItems: ReadonlyArray<DashboardNavigationItem>
  footerItems: ReadonlyArray<DashboardNavigationItem>
  navGroups: ReadonlyArray<{
    label: string
    items: ReadonlyArray<DashboardNavigationItem>
  }>
}>

export const DASHBOARD_NAVIGATION: DashboardNavigation = {
  overview: {
    title: "Genel Bakış",
    url: APP_ROUTES.dashboard.root,
    icon: DashboardSquare01Icon,
  },
  primaryItems: [
    {
      title: "Stok Yönetimi",
      url: APP_ROUTES.dashboard.catalog.inventory,
      icon: Package01Icon,
    },
  ],
  footerItems: [
    {
      title: "Yardım Merkezi",
      url: APP_ROUTES.dashboard.support,
      icon: CustomerSupportIcon,
    },
  ],
  navGroups: [
    {
      label: "Operasyonlar",
      items: [
        {
          title: "Gelen Kutusu",
          url: APP_ROUTES.dashboard.inbox,
          icon: InboxIcon,
        },
        {
          title: "Siparişler & İadeler",
          url: APP_ROUTES.dashboard.orders.root,
          icon: ShoppingBag01Icon,
          items: [
            {
              title: "Tüm Siparişler",
              url: APP_ROUTES.dashboard.orders.root,
              exact: true,
            },
            {
              title: "İade ve Talepler",
              url: APP_ROUTES.dashboard.orders.returns,
            },
          ],
        },
        {
          title: "Ürünler",
          url: APP_ROUTES.dashboard.catalog.products,
          icon: Package01Icon,
        },
        {
          title: "Müşteriler",
          url: APP_ROUTES.dashboard.customers,
          icon: UserGroupIcon,
        },
      ],
    },
    {
      label: "Kanallar ve Otomasyon",
      items: [
        {
          title: "Satış Kanalları",
          url: APP_ROUTES.dashboard.channels.root,
          icon: PlugSocketIcon,
          items: [
            {
              title: "Bağlı Kanallar",
              url: APP_ROUTES.dashboard.channels.root,
              exact: true,
            },
            {
              title: "Senkron Geçmişi",
              url: APP_ROUTES.dashboard.channels.sync,
            },
          ],
        },
        {
          title: "Otomasyonlar",
          url: APP_ROUTES.dashboard.automations,
          icon: WorkflowSquare01Icon,
        },
      ],
    },
    {
      label: "Analiz ve Yönetim",
      items: [
        {
          title: "Raporlar",
          url: APP_ROUTES.dashboard.analytics,
          icon: Analytics01Icon,
        },
        {
          title: "Ayarlar",
          url: APP_ROUTES.dashboard.settings.root,
          icon: Settings02Icon,
        },
      ],
    },
  ],
}

export function getDashboardNavigationTitle(pathname: string) {
  const standaloneItem = [
    DASHBOARD_NAVIGATION.overview,
    ...DASHBOARD_NAVIGATION.primaryItems,
    ...DASHBOARD_NAVIGATION.footerItems,
  ].find((item) => item.url === pathname)

  if (standaloneItem) return standaloneItem.title

  for (const group of DASHBOARD_NAVIGATION.navGroups) {
    for (const item of group.items) {
      if (item.url === pathname) return item.title

      const subItem = item.items?.find(
        (candidate) => candidate.url === pathname
      )
      if (subItem) return subItem.title
    }
  }

  const auxiliaryTitle = DASHBOARD_AUXILIARY_TITLES[pathname]
  if (auxiliaryTitle) return auxiliaryTitle

  return null
}

export function getDashboardBreadcrumbs(
  pathname: string
): ReadonlyArray<DashboardBreadcrumb> {
  const standaloneItem = [
    DASHBOARD_NAVIGATION.overview,
    ...DASHBOARD_NAVIGATION.primaryItems,
    ...DASHBOARD_NAVIGATION.footerItems,
  ].find((item) => item.url === pathname)

  if (standaloneItem) {
    return [{ title: standaloneItem.title, url: standaloneItem.url }]
  }

  for (const group of DASHBOARD_NAVIGATION.navGroups) {
    for (const item of group.items) {
      if (item.url === pathname) {
        return [{ title: item.title, url: item.url }]
      }

      const subItem = item.items?.find(
        (candidate) => candidate.url === pathname
      )

      if (subItem) {
        return [
          { title: item.title, url: item.url },
          { title: subItem.title, url: subItem.url },
        ]
      }
    }
  }

  const settingsTitle = DASHBOARD_AUXILIARY_TITLES[pathname]

  if (settingsTitle) {
    return [
      {
        title: "Ayarlar",
        url: APP_ROUTES.dashboard.settings.root,
      },
      {
        title: settingsTitle,
        url: pathname,
      },
    ]
  }

  return [{ title: "Dashboard", url: APP_ROUTES.dashboard.root }]
}

const DASHBOARD_AUXILIARY_TITLES: Readonly<Record<string, string>> = {
  [APP_ROUTES.dashboard.settings.profile]: "Hesap bilgileri",
  [APP_ROUTES.dashboard.settings.notifications]: "Bildirimler",
  [APP_ROUTES.dashboard.settings.billing]: "Plan ve Faturalama",
}
