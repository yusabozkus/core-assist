import { APP_ROUTES } from "@/constants/site"
import type { StoreAccessLevel } from "@/types/store"

export function canManageStore(accessLevel?: StoreAccessLevel) {
  return (
    accessLevel === "OWNER" ||
    accessLevel === "ACCOUNT_ADMIN" ||
    accessLevel === "STORE_ADMIN"
  )
}

export function canAccessDashboardPage(
  url: string,
  accessLevel?: StoreAccessLevel,
  canManageBilling = false
) {
  if (url === APP_ROUTES.dashboard.team) return canManageBilling
  if (url.startsWith(APP_ROUTES.dashboard.settings.billing)) {
    return canManageBilling
  }
  if (url === APP_ROUTES.dashboard.inbox) {
    return Boolean(accessLevel && accessLevel !== "VIEWER")
  }

  if (
    url === APP_ROUTES.dashboard.channels.root ||
    url.startsWith(`${APP_ROUTES.dashboard.channels.root}/`) ||
    url === APP_ROUTES.dashboard.automations.root ||
    url.startsWith(`${APP_ROUTES.dashboard.automations.root}/`) ||
    url === APP_ROUTES.dashboard.aiTest ||
    url === APP_ROUTES.dashboard.settings.root
  ) {
    return canManageStore(accessLevel)
  }

  return true
}
