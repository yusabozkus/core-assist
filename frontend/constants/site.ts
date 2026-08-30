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
  UserMultipleIcon,
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
      integrations: "/dashboard/channels/integrations",
      sync: "/dashboard/channels/sync",
    },
    automations: "/dashboard/automations",
    analytics: "/dashboard/analytics",
    team: "/dashboard/team",
    support: "/dashboard/support",
    settings: {
      root: "/dashboard/settings",
      profile: "/dashboard/settings/profile",
      stores: "/dashboard/settings/stores",
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
          title: "Siparişler",
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
          title: "Katalog",
          url: APP_ROUTES.dashboard.catalog.root,
          icon: Package01Icon,
          items: [
            {
              title: "Ürünler",
              url: APP_ROUTES.dashboard.catalog.products,
            },
            {
              title: "Stok Yönetimi",
              url: APP_ROUTES.dashboard.catalog.inventory,
            },
          ],
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
              title: "Entegrasyonlar",
              url: APP_ROUTES.dashboard.channels.integrations,
            },
            {
              title: "Senkronizasyon",
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
          title: "Ekip",
          url: APP_ROUTES.dashboard.team,
          icon: UserMultipleIcon,
        },
        {
          title: "Ayarlar",
          url: APP_ROUTES.dashboard.settings.root,
          icon: Settings02Icon,
          items: [
            {
              title: "Genel Ayarlar",
              url: APP_ROUTES.dashboard.settings.root,
              exact: true,
            },
            {
              title: "Mağazalar",
              url: APP_ROUTES.dashboard.settings.stores,
            },
            {
              title: "Bildirimler",
              url: APP_ROUTES.dashboard.settings.notifications,
            },
            {
              title: "Plan ve Faturalama",
              url: APP_ROUTES.dashboard.settings.billing,
            },
          ],
        },
        {
          title: "Yardım Merkezi",
          url: APP_ROUTES.dashboard.support,
          icon: CustomerSupportIcon,
        },
      ],
    },
  ],
}

export function getDashboardNavigationTitle(pathname: string) {
  if (pathname === DASHBOARD_NAVIGATION.overview.url) {
    return DASHBOARD_NAVIGATION.overview.title
  }

  for (const group of DASHBOARD_NAVIGATION.navGroups) {
    for (const item of group.items) {
      if (item.url === pathname) return item.title

      const subItem = item.items?.find(
        (candidate) => candidate.url === pathname
      )
      if (subItem) return subItem.title
    }
  }

  return null
}

export function getDashboardBreadcrumbs(
  pathname: string
): ReadonlyArray<DashboardBreadcrumb> {
  if (pathname === DASHBOARD_NAVIGATION.overview.url) {
    return [
      {
        title: DASHBOARD_NAVIGATION.overview.title,
        url: DASHBOARD_NAVIGATION.overview.url,
      },
    ]
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

  if (pathname === APP_ROUTES.dashboard.settings.profile) {
    return [
      {
        title: "Ayarlar",
        url: APP_ROUTES.dashboard.settings.root,
      },
      {
        title: "Profil",
        url: APP_ROUTES.dashboard.settings.profile,
      },
    ]
  }

  return [{ title: "Dashboard", url: APP_ROUTES.dashboard.root }]
}
