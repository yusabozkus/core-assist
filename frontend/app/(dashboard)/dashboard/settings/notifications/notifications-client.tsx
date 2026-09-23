"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  MoreVerticalIcon,
  Notification01Icon,
  RefreshIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item"
import { NotificationPreferences } from "@/components/dashboard/notifications/notification-preferences"
import { NotificationListSkeleton } from "@/components/skeletons/notification-list-skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import {
  announceNotificationsChanged,
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
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

const VIEWS: Array<{ value: NotificationReadFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "UNREAD", label: "Okunmamış" },
]

export function NotificationsClient({
  storeId,
  storeName,
  scope = "dashboard",
}: {
  storeId?: string
  storeName?: string
  scope?: "dashboard" | "admin"
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view: NotificationView =
    scope === "dashboard" && searchParams.get("view") === "preferences"
      ? "PREFERENCES"
      : searchParams.get("view") === "unread"
        ? "UNREAD"
        : "ALL"
  const filter: NotificationReadFilter = view === "UNREAD" ? "UNREAD" : "ALL"
  const [items, setItems] = useState<AppNotification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const hasUnread =
    (unreadCount ?? 0) > 0 || items.some((notification) => !notification.readAt)

  const refreshUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount(storeId)
      setUnreadCount(result.count)
    } catch {
      return
    }
  }, [storeId])

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
        void refreshUnreadCount()
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
    [filter, refreshUnreadCount, storeId]
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
    if (scope === "admin" && nextView === "PREFERENCES") return
    if (nextView === view) return
    const path =
      scope === "admin"
        ? APP_ROUTES.admin.notifications
        : APP_ROUTES.dashboard.settings.notifications
    const nextUrl =
      nextView === "PREFERENCES"
        ? `${path}?view=preferences`
        : nextView === "UNREAD"
          ? `${path}?view=unread`
          : path
    if (nextView === "PREFERENCES") {
      setError(null)
      router.replace(nextUrl, { scroll: false })
      return
    }

    setLoading(true)
    setItems([])
    setNextCursor(null)
    setHasNextPage(false)
    router.replace(nextUrl, { scroll: false })
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
      setUnreadCount((count) =>
        count === null ? null : Math.max(0, count - 1)
      )
    }

    if (isInternalNotificationUrl(notification.actionUrl, scope)) {
      router.push(notification.actionUrl)
    }
  }

  async function handleMarkAllAsRead() {
    if (markingAll || !hasUnread) return
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
      setUnreadCount(0)
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
      if (!notification.readAt) {
        setUnreadCount((count) =>
          count === null ? null : Math.max(0, count - 1)
        )
      }
      announceNotificationsChanged(storeId)
    } catch {
      setError("Bildirim silinemedi. Lütfen tekrar deneyin.")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    if (deletingAll) return
    setDeletingAll(true)
    setError(null)

    try {
      await deleteAllNotifications(storeId)
      setItems([])
      setNextCursor(null)
      setHasNextPage(false)
      setUnreadCount(0)
      setConfirmDeleteAll(false)
      announceNotificationsChanged(storeId)
    } catch {
      setError("Bildirimler silinemedi. Lütfen tekrar deneyin.")
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[920px] pb-12 sm:px-6 lg:px-8">
      <header className="px-4 pt-6 sm:px-0 sm:pt-8">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {scope === "admin" ? "Yönetim" : storeName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {view === "PREFERENCES" ? "Bildirim tercihleri" : "Bildirimler"}
        </h1>
        <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          {scope === "admin"
            ? "Destek ve yönetim süreçlerindeki önemli gelişmeler."
            : "Mağazanızdaki önemli gelişmeleri tek yerden takip edin."}
        </p>
      </header>

      <div className="sticky top-0 z-10 mt-5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:mt-6 sm:px-0">
        <div className="flex items-center justify-between gap-3">
          {view === "PREFERENCES" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg bg-card"
              onClick={() => handleViewChange("ALL")}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Bildirimlere dön
            </Button>
          ) : (
            <>
              <label className="relative inline-flex shrink-0 sm:hidden">
                <span className="sr-only">Bildirim filtresi</span>
                <select
                  value={filter}
                  onChange={(event) =>
                    handleViewChange(
                      event.target.value as NotificationReadFilter
                    )
                  }
                  className="h-9 w-max min-w-36 appearance-none rounded-lg border border-border bg-card py-1.5 pr-9 pl-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {VIEWS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </label>
              <div
                className="hidden items-center gap-1 rounded-lg border border-border bg-muted/60 p-1 sm:flex"
                role="group"
                aria-label="Bildirim görünümü"
              >
                {VIEWS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={view === option.value}
                    onClick={() => handleViewChange(option.value)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      view === option.value
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                    {option.value === "UNREAD" && (unreadCount ?? 0) > 0 ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary tabular-nums">
                        {(unreadCount ?? 0) > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {scope === "dashboard" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="size-9 bg-card p-0 sm:w-auto sm:px-3"
                    aria-label="Bildirim tercihleri"
                    onClick={() => handleViewChange("PREFERENCES")}
                  >
                    <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                    <span className="hidden sm:inline">Tercihler</span>
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-9 bg-card p-0 sm:w-auto sm:px-3"
                      aria-label="Bildirim işlemleri"
                    >
                      <HugeiconsIcon
                        icon={MoreVerticalIcon}
                        className="size-4"
                      />
                      <span className="hidden sm:inline">İşlemler</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      disabled={markingAll || !hasUnread}
                      onSelect={() => void handleMarkAllAsRead()}
                    >
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className="size-4"
                      />
                      Tümünü okundu yap
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive! focus:bg-destructive/10! focus:text-destructive! data-highlighted:bg-destructive/10! data-highlighted:text-destructive! [&_svg]:text-destructive!"
                      disabled={deletingAll}
                      onSelect={() => {
                        setError(null)
                        setConfirmDeleteAll(true)
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      Tümünü sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>

      {error && view !== "PREFERENCES" ? (
        <div
          className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:mx-0"
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

      <main className="mt-4 sm:mt-5">
        {view === "PREFERENCES" && storeId ? (
          <div className="px-4 sm:px-0">
            <NotificationPreferences storeId={storeId} />
          </div>
        ) : loading && items.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : items.length === 0 ? (
          <section className="mx-4 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/45 px-6 text-center sm:mx-0">
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
                ? "Yeni bir bildirim geldiğinde burada görünecek."
                : "Önemli gelişmeler burada görünecek."}
            </p>
          </section>
        ) : (
          <div className="divide-y divide-border border-y border-border bg-card sm:overflow-hidden sm:rounded-xl sm:border">
            {items.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                list
                showStore={scope === "admin"}
                deleting={deletingId === notification.id}
                onSelect={handleSelect}
                onDelete={(item) => void handleDelete(item)}
              />
            ))}
          </div>
        )}

        {view !== "PREFERENCES" && hasNextPage && items.length > 0 ? (
          <div className="mt-5 flex justify-center px-4 sm:px-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
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
      <ResponsiveDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        preventClose={deletingAll}
        title="Tüm bildirimler silinsin mi?"
        description="Bu işlem geri alınamaz. Bildirimler yalnızca hesabınızdan silinir."
        footer={({ close }) => (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={deletingAll}
              onClick={close}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingAll}
              onClick={() => void handleDeleteAll()}
            >
              {deletingAll ? "Siliniyor..." : "Tümünü sil"}
            </Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          {scope === "admin"
            ? "Yönetim hesabınızdaki tüm bildirimler kaldırılacak."
            : "Bu mağazaya ait ve hesabınıza özel bildirimler kaldırılacak."}
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </ResponsiveDialog>
    </div>
  )
}

function isInternalNotificationUrl(
  actionUrl: string | null,
  scope: "dashboard" | "admin"
): actionUrl is string {
  if (scope === "admin") {
    return Boolean(
      actionUrl && (actionUrl === "/admin" || actionUrl.startsWith("/admin/"))
    )
  }
  return Boolean(
    actionUrl &&
    (actionUrl === "/dashboard" ||
      actionUrl.startsWith("/dashboard/") ||
      actionUrl === "/billing" ||
      actionUrl.startsWith("/billing/"))
  )
}
