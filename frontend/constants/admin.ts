import {
  AiSparklesIcon,
  CreditCardIcon,
  CustomerSupportIcon,
  DashboardSquare01Icon,
  Mail01Icon,
  Notification01Icon,
  RefreshIcon,
  Settings02Icon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import { APP_ROUTES } from "@/constants/site"

export type AdminNavigationItem = Readonly<{
  title: string
  description: string
  url: string
  icon: IconSvgElement
}>

export type AdminNavigationGroup = Readonly<{
  label: string
  items: ReadonlyArray<AdminNavigationItem>
}>

export const ADMIN_NAVIGATION: ReadonlyArray<AdminNavigationItem> = [
  {
    title: "Genel Bakış",
    description: "Sistemin operasyon özeti",
    url: APP_ROUTES.admin.root,
    icon: DashboardSquare01Icon,
  },
  {
    title: "Müşteriler",
    description: "Müşteri hesapları ve ekipleri",
    url: APP_ROUTES.admin.customers,
    icon: UserGroupIcon,
  },
  {
    title: "Destek Talepleri",
    description: "Ticket ve kullanıcı iletişimi",
    url: APP_ROUTES.admin.support,
    icon: CustomerSupportIcon,
  },
  {
    title: "İletişim Mesajları",
    description: "Landing üzerinden gelen mesajlar",
    url: APP_ROUTES.admin.contactMessages,
    icon: Mail01Icon,
  },
  {
    title: "Abonelikler",
    description: "Plan ve ödeme operasyonları",
    url: APP_ROUTES.admin.billing,
    icon: CreditCardIcon,
  },
  {
    title: "Operasyonlar",
    description: "Senkronizasyon ve kuyruklar",
    url: APP_ROUTES.admin.operations,
    icon: RefreshIcon,
  },
  {
    title: "AI ve Kullanım",
    description: "AI performansı ve kotalar",
    url: APP_ROUTES.admin.aiUsage,
    icon: AiSparklesIcon,
  },
  {
    title: "Sistem Sağlığı",
    description: "Servis ve entegrasyon durumu",
    url: APP_ROUTES.admin.system,
    icon: Settings02Icon,
  },
  {
    title: "Denetim Kayıtları",
    description: "Kritik admin işlemleri",
    url: APP_ROUTES.admin.auditLogs,
    icon: ShieldCheckIcon,
  },
]

export const ADMIN_NAVIGATION_GROUPS: ReadonlyArray<AdminNavigationGroup> = [
  {
    label: "Yönetim",
    items: [ADMIN_NAVIGATION[0], ADMIN_NAVIGATION[1], ADMIN_NAVIGATION[4]],
  },
  {
    label: "Destek ve İletişim",
    items: [ADMIN_NAVIGATION[2], ADMIN_NAVIGATION[3]],
  },
  {
    label: "Sistem ve Operasyon",
    items: ADMIN_NAVIGATION.slice(5),
  },
]

export const ADMIN_ACCOUNT_NAVIGATION_ITEM: AdminNavigationItem = {
  title: "Hesap ve güvenlik",
  description: "Profil, giriş yöntemleri ve oturumlar",
  url: APP_ROUTES.admin.account,
  icon: ShieldCheckIcon,
}

export const ADMIN_NOTIFICATIONS_NAVIGATION_ITEM: AdminNavigationItem = {
  title: "Bildirimler",
  description: "Yönetim uyarıları ve destek gelişmeleri",
  url: APP_ROUTES.admin.notifications,
  icon: Notification01Icon,
}

export const ADMIN_SEARCH_NAVIGATION = [
  ...ADMIN_NAVIGATION,
  ADMIN_NOTIFICATIONS_NAVIGATION_ITEM,
  ADMIN_ACCOUNT_NAVIGATION_ITEM,
] as const

export function getAdminNavigationItem(pathname: string) {
  if (pathname === APP_ROUTES.admin.notifications) {
    return ADMIN_NOTIFICATIONS_NAVIGATION_ITEM
  }

  if (pathname === APP_ROUTES.admin.account) {
    return ADMIN_ACCOUNT_NAVIGATION_ITEM
  }

  return (
    ADMIN_NAVIGATION.find((item) => item.url === pathname) ??
    ADMIN_NAVIGATION.find(
      (item) =>
        item.url !== APP_ROUTES.admin.root &&
        pathname.startsWith(`${item.url}/`)
    ) ??
    null
  )
}
