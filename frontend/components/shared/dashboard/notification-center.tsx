"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Notification01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item"
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
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/types/notification"

const FALLBACK_POLL_INTERVAL_MS = 60_000

export function NotificationCenter({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRequestRef = useRef<AbortController | null>(null)
  const openRef = useRef(false)

  const refreshCount = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await getUnreadNotificationCount(storeId, signal)
        if (!signal?.aborted) setUnreadCount(result.count)
      } catch {
        // Header sayacı geçici API hatalarında son bilinen değeri korur.
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
      if (controller.signal.aborted) return
      setItems(result.items)
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

  useEffect(() => {
    const controller = new AbortController()
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
      if (!changedStoreId || changedStoreId === storeId) {
        void refreshCount()
        if (openRef.current) void refreshList()
      }
    }

    const eventSource = new EventSource(getNotificationStreamUrl(storeId), {
      withCredentials: true,
    })
    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { kind?: string }
        if (message.kind === "CHANGED") {
          announceNotificationsChanged(storeId)
        }
      } catch {
        // Geçersiz bir akış mesajı mevcut listeyi etkilemez.
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
    }
  }, [refreshCount, refreshList, storeId])

  function handleOpenChange(nextOpen: boolean) {
    openRef.current = nextOpen
    setOpen(nextOpen)
    if (nextOpen) void refreshList()
  }

  function handleSelect(notification: AppNotification) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString()
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
      void markNotificationAsRead(notification.id)
        .then(() => announceNotificationsChanged(storeId))
        .catch(() => void refreshCount())
    }

    setOpen(false)
    router.push(getSafeActionUrl(notification.actionUrl))
  }

  async function handleMarkAllAsRead() {
    if (markingAll || unreadCount === 0) return
    setMarkingAll(true)
    setError(null)

    try {
      await markAllNotificationsAsRead(storeId)
      const readAt = new Date().toISOString()
      setItems((current) =>
        current.map((notification) => ({ ...notification, readAt }))
      )
      setUnreadCount(0)
      announceNotificationsChanged(storeId)
    } catch {
      setError("Bildirimler okundu olarak işaretlenemedi.")
    } finally {
      setMarkingAll(false)
    }
  }

  const countLabel = unreadCount > 99 ? "99+" : unreadCount.toString()

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="relative bg-card shadow-xs"
          aria-label={
            unreadCount
              ? `Bildirimler, ${unreadCount} okunmamış bildirim`
              : "Bildirimler"
          }
        >
          <HugeiconsIcon icon={Notification01Icon} className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-4.5 font-bold text-white ring-2 ring-background">
              {countLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-1.5rem)] max-w-[25rem] gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Bildirimler
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {unreadCount
                ? `${unreadCount} okunmamış bildiriminiz var`
                : "Yeni bildiriminiz yok"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-[11px]"
            disabled={markingAll || unreadCount === 0}
            onClick={() => void handleMarkAllAsRead()}
          >
            <HugeiconsIcon
              icon={markingAll ? RefreshIcon : CheckmarkCircle01Icon}
              className={cn("size-3.5", markingAll && "animate-spin")}
            />
            Tümünü okundu yap
          </Button>
        </div>

        <div className="themed-scrollbar max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto">
          {loading && items.length === 0 ? (
            <NotificationListSkeleton compact count={4} />
          ) : error && items.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <HugeiconsIcon icon={Notification01Icon} className="size-4.5" />
              </span>
              <p className="mt-3 text-sm font-medium">Bildirimler alınamadı</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Bağlantınızı kontrol edip tekrar deneyin.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void refreshList()}
              >
                Tekrar dene
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HugeiconsIcon icon={Notification01Icon} className="size-4.5" />
              </span>
              <p className="mt-3 text-sm font-medium">Her şey yolunda</p>
              <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                İncelemeniz gereken yeni bir mağaza olayı bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {items.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  compact
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/25 p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-between"
          >
            <Link
              href={APP_ROUTES.dashboard.settings.notifications}
              onClick={() => setOpen(false)}
            >
              Tüm bildirimleri görüntüle
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </Button>
        </div>

        {error && items.length > 0 ? (
          <p
            className="border-t border-border px-4 py-2 text-[11px] text-destructive"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function getSafeActionUrl(actionUrl: string | null) {
  return actionUrl?.startsWith("/dashboard")
    ? actionUrl
    : APP_ROUTES.dashboard.settings.notifications
}
