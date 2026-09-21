import { apiFetch, getApiUrl } from "@/lib/api/client"
import type {
  NotificationPage,
  NotificationPreference,
  NotificationPreferences,
  NotificationReadFilter,
  NotificationType,
  NotificationDeliverySettings,
} from "@/types/notification"

type GetNotificationsOptions = {
  storeId?: string
  cursor?: string | null
  limit?: number
  status?: NotificationReadFilter
  type?: NotificationType
  signal?: AbortSignal
}

export const NOTIFICATIONS_CHANGED_EVENT = "coreassist:notifications-changed"

export function getNotifications({
  storeId,
  cursor,
  limit = 20,
  status = "ALL",
  type,
  signal,
}: GetNotificationsOptions = {}) {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    status,
  })

  if (storeId) searchParams.set("storeId", storeId)
  if (cursor) searchParams.set("cursor", cursor)
  if (type) searchParams.set("type", type)

  return apiFetch<NotificationPage>(
    `/notifications?${searchParams.toString()}`,
    { cache: "no-store", signal }
  )
}

export function getUnreadNotificationCount(
  storeId?: string,
  signal?: AbortSignal
) {
  const searchParams = new URLSearchParams()
  if (storeId) searchParams.set("storeId", storeId)

  const query = searchParams.size ? `?${searchParams.toString()}` : ""
  return apiFetch<{ count: number }>(`/notifications/unread-count${query}`, {
    cache: "no-store",
    signal,
  })
}

export function markNotificationAsRead(notificationId: string) {
  return apiFetch<{ id: string; read: true }>(
    `/notifications/${notificationId}/read`,
    { method: "PATCH" }
  )
}

export function markAllNotificationsAsRead(storeId?: string) {
  return apiFetch<{ updated: number }>("/notifications/read-all", {
    method: "PATCH",
    body: JSON.stringify({ storeId }),
  })
}

export function deleteNotification(notificationId: string) {
  return apiFetch<void>(`/notifications/${notificationId}`, {
    method: "DELETE",
  })
}

export function getNotificationPreferences(
  storeId: string,
  signal?: AbortSignal
) {
  const searchParams = new URLSearchParams({ storeId })
  return apiFetch<NotificationPreferences>(
    `/notifications/preferences?${searchParams.toString()}`,
    { cache: "no-store", signal }
  )
}

export function getNotificationStreamUrl(storeId?: string) {
  const searchParams = new URLSearchParams()
  if (storeId) searchParams.set("storeId", storeId)
  const query = searchParams.size ? `?${searchParams.toString()}` : ""
  return getApiUrl(`/notifications/stream${query}`)
}

export function updateNotificationPreferences(
  storeId: string,
  preferences: NotificationPreference[]
) {
  return apiFetch<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify({ storeId, preferences }),
  })
}

export function announceNotificationsChanged(storeId?: string) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { storeId } })
  )
}

export function getNotificationDeliverySettings(
  storeId: string,
  signal?: AbortSignal
) {
  const searchParams = new URLSearchParams({ storeId })
  return apiFetch<NotificationDeliverySettings>(
    `/notifications/delivery-settings?${searchParams.toString()}`,
    { cache: "no-store", signal }
  )
}

export function updateNotificationDeliverySettings(
  storeId: string,
  settings: Partial<
    Pick<
      NotificationDeliverySettings,
      | "browserEnabled"
      | "emailEnabled"
      | "quietHoursEnabled"
      | "quietHoursStart"
      | "quietHoursEnd"
      | "timezone"
    >
  >
) {
  return apiFetch<NotificationDeliverySettings>(
    "/notifications/delivery-settings",
    {
      method: "PATCH",
      body: JSON.stringify({ storeId, ...settings }),
    }
  )
}

export function getWebPushPublicKey() {
  return apiFetch<{ configured: boolean; publicKey: string | null }>(
    "/notifications/push/public-key",
    { cache: "no-store" }
  )
}

export function saveWebPushSubscription(
  storeId: string,
  subscription: PushSubscription
) {
  const serialized = subscription.toJSON()
  if (
    !serialized.endpoint ||
    !serialized.keys?.p256dh ||
    !serialized.keys.auth
  ) {
    throw new Error("Tarayıcı abonelik bilgisi alınamadı.")
  }

  return apiFetch<{ subscribed: true }>("/notifications/push/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      storeId,
      endpoint: serialized.endpoint,
      keys: serialized.keys,
    }),
  })
}
