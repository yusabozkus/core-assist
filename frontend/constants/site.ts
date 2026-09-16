import {
  Analytics01Icon,
  BoxesIcon,
  DashboardSquare01Icon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  RefreshIcon,
  Settings02Icon,
  UserGroupIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  authContinue: "/auth/continue",
  register: "/register",
  onboarding: "/onboarding",
  checkout: "/checkout",
  admin: {
    root: "/admin",
    customers: "/admin/customers",
    support: "/admin/support",
    billing: "/admin/billing",
    operations: "/admin/operations",
    aiUsage: "/admin/ai-usage",
    system: "/admin/system",
    auditLogs: "/admin/audit-logs",
  },
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
    channels: {
      root: "/dashboard/channels",
      sync: "/dashboard/channels/sync",
    },
    automations: {
      root: "/dashboard/automations",
      knowledge: "/dashboard/automations/knowledge",
    },
    analytics: "/dashboard/analytics",
    team: "/dashboard/team",
    support: "/dashboard/support",
    settings: {
      root: "/dashboard/settings",
      profile: "/dashboard/settings/profile",
      notifications: "/dashboard/settings/notifications",
      billing: "/billing",
      plans: "/billing?view=plans",
      invoices: "/billing?view=invoices",
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
  exact?: boolean
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
  primaryItems: [],
  footerItems: [
    {
      title: "Ekip ve Yetkiler",
      url: APP_ROUTES.dashboard.team,
      icon: UserGroupIcon,
      exact: true,
    },
    {
      title: "Mağaza Ayarları",
      url: APP_ROUTES.dashboard.settings.root,
      icon: Settings02Icon,
      exact: true,
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
          title: "Stok Takibi",
          url: APP_ROUTES.dashboard.catalog.inventory,
          icon: BoxesIcon,
        },
        {
          title: "Ürünler",
          url: APP_ROUTES.dashboard.catalog.products,
          icon: Package01Icon,
        },
      ],
    },
    {
      label: "Kanallar ve AI",
      items: [
        {
          title: "Bağlı Kanallar",
          url: APP_ROUTES.dashboard.channels.root,
          icon: PlugSocketIcon,
          exact: true,
        },
        {
          title: "Senkron Geçmişi",
          url: APP_ROUTES.dashboard.channels.sync,
          icon: RefreshIcon,
        },
        {
          title: "AI Yönetimi",
          url: APP_ROUTES.dashboard.automations.root,
          icon: WorkflowSquare01Icon,
          items: [
            {
              title: "Yanıt Ayarları",
              url: APP_ROUTES.dashboard.automations.root,
              exact: true,
            },
            {
              title: "Bilgi Tabanı",
              url: APP_ROUTES.dashboard.automations.knowledge,
            },
          ],
        },
      ],
    },
    {
      label: "Analiz",
      items: [
        {
          title: "AI Performansı",
          url: APP_ROUTES.dashboard.analytics,
          icon: Analytics01Icon,
        },
      ],
    },
  ],
}

export function getDashboardNavigationTitle(pathname: string) {
  const standaloneTitle = DASHBOARD_STANDALONE_TITLES[pathname]
  if (standaloneTitle) return standaloneTitle

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
  const standaloneTitle = DASHBOARD_STANDALONE_TITLES[pathname]

  if (standaloneTitle) {
    return [{ title: standaloneTitle, url: pathname }]
  }

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
  [APP_ROUTES.dashboard.settings.profile]: "Hesap ve güvenlik",
  [APP_ROUTES.dashboard.settings.notifications]: "Bildirimler",
  [APP_ROUTES.dashboard.settings.billing]: "Plan ve Faturalama",
  [APP_ROUTES.dashboard.settings.plans]: "Planlar",
  [APP_ROUTES.dashboard.settings.invoices]: "Faturalar",
}

const DASHBOARD_STANDALONE_TITLES: Readonly<Record<string, string>> = {
  [APP_ROUTES.dashboard.support]: "Yardım Merkezi",
}
