"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Notification01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item"
import { NotificationToast } from "@/components/dashboard/notifications/notification-toast"
import { NotificationListSkeleton } from "@/components/skeletons/notification-list-skeleton"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { APP_ROUTES } from "@/constants/site"
import {
  announceNotificationsChanged,
  getNotifications,
  getNotificationStreamUrl,
  getUnreadNotificationCount,
  markNotificationAsRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/types/notification"

const FALLBACK_POLL_INTERVAL_MS = 60_000

export function NotificationCenter({
  storeId,
  scope = "dashboard",
  headless = false,
}: {
  storeId?: string
  scope?: "dashboard" | "admin"
  headless?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRequestRef = useRef<AbortController | null>(null)
  const openRef = useRef(false)
  const toastRequestsRef = useRef(new Set<AbortController>())
  const shownToastKeysRef = useRef(new Set<string>())
  const activeToastIdsRef = useRef(new Set<string | number>())
  const streamConnectedAtRef = useRef<number | null>(null)

  const refreshCount = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await getUnreadNotificationCount(storeId, signal)
        if (!signal?.aborted) setUnreadCount(result.count)
      } catch {
        return
      }
    },
    [storeId]
  )

  const refreshList = useCallback(async () => {
    listRequestRef.current?.abort()
    const controller = new AbortController()
    listRequestRef.current = controller
    setLoading(true)
    setError(null)

    try {
      const result = await getNotifications({
        storeId,
        limit: 8,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setItems(result.items)
    } catch {
      if (!controller.signal.aborted) {
        setError("Bildirimler şu anda alınamıyor.")
      }
    } finally {
      if (listRequestRef.current === controller) {
        listRequestRef.current = null
        setLoading(false)
      }
    }
  }, [storeId])

  function handleOpenChange(nextOpen: boolean) {
    openRef.current = nextOpen
    setOpen(nextOpen)
    if (nextOpen) void refreshList()
    else listRequestRef.current?.abort()
  }

  const handleSelect = useCallback(
    (notification: AppNotification) => {
      if (!notification.readAt) {
        setUnreadCount((count) => Math.max(0, count - 1))
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: new Date().toISOString() }
              : item
          )
        )
        void markNotificationAsRead(notification.id)
          .then(() => announceNotificationsChanged(storeId))
          .catch(() => void refreshCount())
      }

      openRef.current = false
      setOpen(false)
      listRequestRef.current?.abort()
      router.push(getSafeActionUrl(notification.actionUrl, scope))
    },
    [refreshCount, router, scope, storeId]
  )

  const showCreatedNotifications = useCallback(
    async (occurredAt: string) => {
      const eventTimestamp = Date.parse(occurredAt)
      if (!Number.isFinite(eventTimestamp)) return

      const controller = new AbortController()
      toastRequestsRef.current.add(controller)

      try {
        const result = await getNotifications({
          storeId,
          status: "UNREAD",
          limit: 10,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return

        const earliestOccurrence = streamConnectedAtRef.current
          ? Math.max(eventTimestamp - 5_000, streamConnectedAtRef.current)
          : eventTimestamp - 5_000
        const matchingNotifications = result.items
          .filter((notification) => {
            const lastOccurredAt = Date.parse(notification.lastOccurredAt)
            return (
              notification.readAt === null &&
              Number.isFinite(lastOccurredAt) &&
              lastOccurredAt >= earliestOccurrence &&
              lastOccurredAt <= eventTimestamp + 5_000
            )
          })
          .sort(
            (left, right) =>
              Date.parse(left.lastOccurredAt) - Date.parse(right.lastOccurredAt)
          )

        for (const notification of matchingNotifications) {
          const toastKey = `${notification.id}:${notification.lastOccurredAt}:${notification.occurrenceCount}`
          if (shownToastKeysRef.current.has(toastKey)) continue
          shownToastKeysRef.current.add(toastKey)

          const toastId = toast.custom(
            (id) => (
              <NotificationToast
                notification={notification}
                onOpen={() => {
                  activeToastIdsRef.current.delete(id)
                  toast.dismiss(id)
                  handleSelect(notification)
                }}
                onDismiss={() => {
                  activeToastIdsRef.current.delete(id)
                  toast.dismiss(id)
                }}
              />
            ),
            {
              duration: 3_000,
              position: "top-center",
              onAutoClose: (closedToast) => {
                activeToastIdsRef.current.delete(closedToast.id)
              },
              onDismiss: (closedToast) => {
                activeToastIdsRef.current.delete(closedToast.id)
              },
            }
          )
          activeToastIdsRef.current.add(toastId)
        }

        if (shownToastKeysRef.current.size > 200) {
          shownToastKeysRef.current = new Set(
            [...shownToastKeysRef.current].slice(-100)
          )
        }
      } catch {
        return
      } finally {
        toastRequestsRef.current.delete(controller)
      }
    },
    [handleSelect, storeId]
  )

  useEffect(() => {
    const controller = new AbortController()
    const toastRequests = toastRequestsRef.current
    const activeToastIds = activeToastIdsRef.current
    const initialRefreshId = window.setTimeout(
      () => void refreshCount(controller.signal),
      0
    )

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCount()
    }, FALLBACK_POLL_INTERVAL_MS)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refreshCount()
    }

    function handleNotificationsChanged(event: Event) {
      const changedStoreId = (event as CustomEvent<{ storeId?: string }>).detail
        ?.storeId
      if (!storeId || !changedStoreId || changedStoreId === storeId) {
        void refreshCount()
        if (openRef.current) void refreshList()
      }
    }

    const eventSource = new EventSource(getNotificationStreamUrl(storeId), {
      withCredentials: true,
    })
    streamConnectedAtRef.current = null
    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          kind?: string
          reason?: "CREATED" | "READ" | "READ_ALL" | "DELETED"
          occurredAt?: string
        }
        if (message.kind === "CONNECTED" && message.occurredAt) {
          const connectedAt = Date.parse(message.occurredAt)
          if (Number.isFinite(connectedAt)) {
            streamConnectedAtRef.current = connectedAt
          }
        }
        if (message.kind === "CHANGED") {
          announceNotificationsChanged(storeId)
          if (message.reason === "CREATED" && message.occurredAt) {
            void showCreatedNotifications(message.occurredAt)
          }
        }
      } catch {
        return
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener(
      NOTIFICATIONS_CHANGED_EVENT,
      handleNotificationsChanged
    )

    return () => {
      controller.abort()
      window.clearTimeout(initialRefreshId)
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        handleNotificationsChanged
      )
      eventSource.close()
      listRequestRef.current?.abort()
      for (const request of toastRequests) request.abort()
      toastRequests.clear()
      for (const toastId of activeToastIds) toast.dismiss(toastId)
      activeToastIds.clear()
      streamConnectedAtRef.current = null
    }
  }, [refreshCount, refreshList, showCreatedNotifications, storeId])

  if (headless) return null

  const countLabel = unreadCount > 99 ? "99+" : unreadCount.toString()
  const href =
    scope === "admin"
      ? APP_ROUTES.admin.notifications
      : APP_ROUTES.dashboard.settings.notifications
  const triggerClassName = cn(
    "relative flex size-10 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-9",
    scope === "admin"
      ? "border-transparent hover:bg-muted/80 hover:text-foreground"
      : "border-border bg-card shadow-xs hover:bg-muted/70 hover:text-foreground"
  )
  const triggerLabel = unreadCount
    ? `Bildirimler, ${unreadCount} okunmamış bildirim`
    : "Bildirimler"
  const badge =
    unreadCount > 0 ? (
      <span className="absolute -top-1.5 -right-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-4.5 font-bold text-white ring-2 ring-background">
        {countLabel}
      </span>
    ) : null

  return (
    <>
      <Link
        href={href}
        className={cn(triggerClassName, "lg:hidden")}
        aria-label={triggerLabel}
        title="Bildirimler"
      >
        <HugeiconsIcon icon={Notification01Icon} className="size-4" />
        {badge}
      </Link>
      <div className="hidden lg:block">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={triggerClassName}
              aria-label={triggerLabel}
            >
              <HugeiconsIcon icon={Notification01Icon} className="size-4" />
              {badge}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[25rem] gap-0 overflow-hidden rounded-2xl p-0"
          >
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-semibold">Bildirimler</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {unreadCount
                  ? `${unreadCount} okunmamış bildiriminiz var`
                  : "Yeni bildiriminiz yok"}
              </p>
            </div>
            <div className="themed-scrollbar max-h-[min(28rem,calc(100vh-10rem))] divide-y divide-border overflow-y-auto">
              {loading && items.length === 0 ? (
                <NotificationListSkeleton count={4} />
              ) : error && items.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 text-center">
                  <p className="text-xs text-muted-foreground">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshList()}
                  >
                    Tekrar dene
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center px-5 text-center text-xs text-muted-foreground">
                  Henüz bildiriminiz yok.
                </div>
              ) : (
                items.map((notification) => (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    list
                    showStore={scope === "admin"}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>
            <Link
              href={href}
              onClick={() => handleOpenChange(false)}
              className="flex h-11 items-center justify-center border-t border-border text-xs font-medium text-primary transition-colors hover:bg-muted/50"
            >
              Tüm bildirimleri görüntüle
            </Link>
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}

function getSafeActionUrl(
  actionUrl: string | null,
  scope: "dashboard" | "admin"
) {
  if (scope === "admin") {
    return actionUrl &&
      (actionUrl === "/admin" || actionUrl.startsWith("/admin/"))
      ? actionUrl
      : APP_ROUTES.admin.notifications
  }

  return actionUrl &&
    (actionUrl === "/dashboard" ||
      actionUrl.startsWith("/dashboard/") ||
      actionUrl === "/billing" ||
      actionUrl.startsWith("/billing/"))
    ? actionUrl
    : APP_ROUTES.dashboard.settings.notifications
}
