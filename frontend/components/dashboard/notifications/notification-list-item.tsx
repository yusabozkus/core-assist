"use client"

import { Delete02Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  NOTIFICATION_SEVERITY_STYLES,
  NOTIFICATION_TYPE_DETAILS,
} from "@/components/dashboard/notifications/notification-presentation"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/types/notification"

export function NotificationListItem({
  notification,
  list = false,
  showStore = false,
  deleting = false,
  onSelect,
  onDelete,
}: {
  notification: AppNotification
  list?: boolean
  showStore?: boolean
  deleting?: boolean
  onSelect: (notification: AppNotification) => void
  onDelete?: (notification: AppNotification) => void
}) {
  const details = NOTIFICATION_TYPE_DETAILS[notification.type]
  const severity = NOTIFICATION_SEVERITY_STYLES[notification.severity]
  const unread = notification.readAt === null

  return (
    <article
      className={cn(
        "group relative flex min-w-0 items-start gap-3 transition-colors",
        list
          ? "px-4 py-4 sm:px-5"
          : "rounded-xl border border-border px-4 py-4",
        unread ? "bg-primary/[0.09]" : "bg-card",
        list
          ? unread
            ? "hover:bg-primary/[0.12]"
            : "hover:bg-muted/45"
          : unread
            ? "hover:border-primary/30 hover:bg-primary/[0.12]"
            : "hover:border-foreground/15 hover:bg-muted/25"
      )}
    >
      {unread ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary/70"
        />
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`${notification.title} bildirimini aç`}
      />

      <span
        className={cn(
          "pointer-events-none relative mt-0.5 flex shrink-0 items-center justify-center rounded-lg",
          list ? "size-10 sm:size-9" : "size-9",
          severity.icon,
          !unread && "opacity-60"
        )}
      >
        <HugeiconsIcon icon={details.icon} className="size-4" />
      </span>

      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-5",
              unread
                ? "font-semibold text-foreground"
                : "font-normal text-muted-foreground"
            )}
          >
            {notification.title}
          </p>
          {unread ? (
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                severity.dot
              )}
              aria-label="Okunmamış"
            />
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1 text-xs leading-5",
            unread ? "text-foreground/75" : "text-muted-foreground",
            list ? "line-clamp-2 sm:line-clamp-3" : "line-clamp-3"
          )}
        >
          {notification.message}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {showStore && notification.store ? (
            <>
              <span
                className={cn(
                  "font-medium",
                  unread ? "text-foreground/75" : "text-muted-foreground"
                )}
              >
                {notification.store.name}
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{details.label}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={notification.lastOccurredAt}>
            {formatNotificationTime(notification.lastOccurredAt)}
          </time>
          {notification.occurrenceCount > 1 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{notification.occurrenceCount} kez tekrarlandı</span>
            </>
          ) : null}
        </div>
      </div>

      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={deleting}
          onClick={() => onDelete(notification)}
          className="relative -mr-1 size-9 shrink-0 text-muted-foreground opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          aria-label="Bildirimi sil"
        >
          <HugeiconsIcon
            icon={deleting ? RefreshIcon : Delete02Icon}
            className={cn("size-3.5", deleting && "animate-spin")}
          />
        </Button>
      ) : null}
    </article>
  )
}

export function formatNotificationTime(value: string) {
  const date = new Date(value)
  const differenceMs = date.getTime() - Date.now()
  const absoluteMs = Math.abs(differenceMs)

  if (!Number.isFinite(date.getTime())) return ""
  if (absoluteMs < 60_000) return "Az önce"

  const relativeFormatter = new Intl.RelativeTimeFormat("tr-TR", {
    numeric: "auto",
  })

  if (absoluteMs < 3_600_000) {
    return relativeFormatter.format(Math.round(differenceMs / 60_000), "minute")
  }

  if (absoluteMs < 86_400_000) {
    return relativeFormatter.format(
      Math.round(differenceMs / 3_600_000),
      "hour"
    )
  }

  if (absoluteMs < 604_800_000) {
    return relativeFormatter.format(
      Math.round(differenceMs / 86_400_000),
      "day"
    )
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date)
}
