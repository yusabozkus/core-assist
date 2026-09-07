"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Notification01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item"
import { NotificationPreferences } from "@/components/dashboard/notifications/notification-preferences"
import { NotificationListSkeleton } from "@/components/skeletons/notification-list-skeleton"
import { Button } from "@/components/ui/button"
import {
  announceNotificationsChanged,
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import type {
  AppNotification,
  NotificationReadFilter,
} from "@/types/notification"

type NotificationView = NotificationReadFilter | "PREFERENCES"

const VIEWS: Array<{ value: NotificationView; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "UNREAD", label: "Okunmamış" },
  { value: "PREFERENCES", label: "Tercihler" },
]

export function NotificationsClient({
  storeId,
  storeName,
}: {
  storeId: string
  storeName: string
}) {
  const router = useRouter()
  const [view, setView] = useState<NotificationView>("ALL")
  const filter: NotificationReadFilter = view === "UNREAD" ? "UNREAD" : "ALL"
  const [items, setItems] = useState<AppNotification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const loadNotifications = useCallback(
    async ({
      append = false,
      cursor,
    }: { append?: boolean; cursor?: string | null } = {}) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const result = await getNotifications({
          storeId,
          status: filter,
          cursor: append ? cursor : undefined,
          limit: 20,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return

        setItems((current) =>
          append ? [...current, ...result.items] : result.items
        )
        setNextCursor(result.pageInfo.nextCursor)
        setHasNextPage(result.pageInfo.hasNextPage)
      } catch {
        if (!controller.signal.aborted) {
          setError("Bildirimler alınamadı. Lütfen tekrar deneyin.")
        }
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [filter, storeId]
  )

  useEffect(() => {
    if (view === "PREFERENCES") return
    const timeoutId = window.setTimeout(() => void loadNotifications(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      requestRef.current?.abort()
    }
  }, [loadNotifications, view])

  useEffect(() => {
    if (view === "PREFERENCES") return

    let refreshId: number | null = null
    function handleNotificationsChanged(event: Event) {
      const changedStoreId = (event as CustomEvent<{ storeId?: string }>).detail
        ?.storeId
      if (changedStoreId && changedStoreId !== storeId) return

      if (refreshId) window.clearTimeout(refreshId)
      refreshId = window.setTimeout(() => void loadNotifications(), 120)
    }

    window.addEventListener(
      NOTIFICATIONS_CHANGED_EVENT,
      handleNotificationsChanged
    )

    return () => {
      if (refreshId) window.clearTimeout(refreshId)
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        handleNotificationsChanged
      )
    }
  }, [loadNotifications, storeId, view])

  function handleViewChange(nextView: NotificationView) {
    if (nextView === view) return
    if (nextView === "PREFERENCES") {
      setView(nextView)
      setError(null)
      return
    }

    setLoading(true)
    setItems([])
    setNextCursor(null)
    setHasNextPage(false)
    setView(nextView)
  }

  function handleSelect(notification: AppNotification) {
    if (!notification.readAt) {
      if (filter === "UNREAD") {
        setItems((current) =>
          current.filter((item) => item.id !== notification.id)
        )
      } else {
        const readAt = new Date().toISOString()
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, readAt } : item
          )
        )
      }

      void markNotificationAsRead(notification.id)
        .then(() => announceNotificationsChanged(storeId))
        .catch(() => void loadNotifications())
    }

    if (notification.actionUrl?.startsWith("/dashboard")) {
      router.push(notification.actionUrl)
    }
  }

  async function handleMarkAllAsRead() {
    if (markingAll || !items.some((item) => !item.readAt)) return
    setMarkingAll(true)
    setError(null)

    try {
      await markAllNotificationsAsRead(storeId)
      if (filter === "UNREAD") {
        setItems([])
      } else {
        const readAt = new Date().toISOString()
        setItems((current) =>
          current.map((notification) => ({ ...notification, readAt }))
        )
      }
      announceNotificationsChanged(storeId)
    } catch {
      setError("Bildirimler okundu olarak işaretlenemedi.")
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleDelete(notification: AppNotification) {
    if (deletingId) return
    setDeletingId(notification.id)
    setError(null)

    try {
      await deleteNotification(notification.id)
      setItems((current) =>
        current.filter((item) => item.id !== notification.id)
      )
      announceNotificationsChanged(storeId)
    } catch {
      setError("Bildirim silinemedi. Lütfen tekrar deneyin.")
    } finally {
      setDeletingId(null)
    }
  }

  const unreadOnPage = items.filter(
    (notification) => !notification.readAt
  ).length

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {storeName}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Bildirimler
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            AI incelemelerini, senkronizasyon sorunlarını ve kritik stok
            değişikliklerini tek yerden takip edin.
          </p>
        </div>

        {view !== "PREFERENCES" ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadNotifications()}
              disabled={loading}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                className={cn("size-3.5", loading && "animate-spin")}
              />
              Yenile
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAllAsRead()}
              disabled={markingAll || unreadOnPage === 0}
            >
              <HugeiconsIcon
                icon={markingAll ? RefreshIcon : CheckmarkCircle01Icon}
                className={cn("size-3.5", markingAll && "animate-spin")}
              />
              Tümünü okundu yap
            </Button>
          </div>
        ) : null}
      </header>

      <div
        className="mt-8 flex items-center gap-6 border-b border-border"
        role="tablist"
      >
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            onClick={() => handleViewChange(option.value)}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors",
              view === option.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {view === option.value ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        ))}
      </div>

      {error && view !== "PREFERENCES" ? (
        <div
          className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold underline underline-offset-4"
            onClick={() => void loadNotifications()}
          >
            Tekrar dene
          </button>
        </div>
      ) : null}

      <main className="mt-5">
        {view === "PREFERENCES" ? (
          <NotificationPreferences storeId={storeId} />
        ) : loading && items.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : items.length === 0 ? (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/45 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={
                  filter === "UNREAD"
                    ? CheckmarkCircle01Icon
                    : Notification01Icon
                }
                className="size-5"
              />
            </span>
            <h2 className="mt-4 text-sm font-semibold">
              {filter === "UNREAD"
                ? "Okunmamış bildirim kalmadı"
                : "Henüz bildiriminiz yok"}
            </h2>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              {filter === "UNREAD"
                ? "Yeni bir kritik mağaza olayı oluştuğunda burada gösterilecek."
                : "Senkronizasyon, stok ve AI iş akışındaki önemli gelişmeler burada görünecek."}
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {items.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                deleting={deletingId === notification.id}
                onSelect={handleSelect}
                onDelete={(item) => void handleDelete(item)}
              />
            ))}
          </div>
        )}

        {view !== "PREFERENCES" && hasNextPage && items.length > 0 ? (
          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() =>
                void loadNotifications({ append: true, cursor: nextCursor })
              }
            >
              {loadingMore ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-3.5 animate-spin"
                />
              ) : null}
              {loadingMore ? "Yükleniyor..." : "Daha fazla göster"}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
