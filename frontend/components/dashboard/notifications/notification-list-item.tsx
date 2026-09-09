"use client"

import {
  AiBrain01Icon,
  AlertCircleIcon,
  Delete02Icon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  AppNotification,
  NotificationSeverity,
  NotificationType,
} from "@/types/notification"

const NOTIFICATION_TYPE_DETAILS: Record<
  NotificationType,
  {
    label: string
    icon: typeof AlertCircleIcon
  }
> = {
  AI_REVIEW_REQUIRED: { label: "İnceleme", icon: AiBrain01Icon },
  AI_DRAFT_FAILED: { label: "AI taslağı", icon: AiBrain01Icon },
  AI_USAGE_LIMIT: { label: "Plan kullanımı", icon: AiBrain01Icon },
  ANSWER_DELIVERY_FAILED: { label: "Yanıt", icon: InboxIcon },
  PRODUCT_SYNC_FAILED: { label: "Ürün senkronizasyonu", icon: RefreshIcon },
  QUESTION_SYNC_FAILED: { label: "Soru senkronizasyonu", icon: RefreshIcon },
  LOW_STOCK: { label: "Stok", icon: Package01Icon },
  OUT_OF_STOCK: { label: "Stok", icon: Package01Icon },
  CHANNEL_CONNECTION_ERROR: { label: "Kanal", icon: PlugSocketIcon },
  BILLING_PLAN_LIMIT: { label: "Plan limiti", icon: Package01Icon },
}

const SEVERITY_STYLES: Record<
  NotificationSeverity,
  { icon: string; dot: string }
> = {
  INFO: {
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  WARNING: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  ERROR: {
    icon: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
}

export function NotificationListItem({
  notification,
  compact = false,
  deleting = false,
  onSelect,
  onDelete,
}: {
  notification: AppNotification
  compact?: boolean
  deleting?: boolean
  onSelect: (notification: AppNotification) => void
  onDelete?: (notification: AppNotification) => void
}) {
  const details = NOTIFICATION_TYPE_DETAILS[notification.type]
  const severity = SEVERITY_STYLES[notification.severity]
  const unread = notification.readAt === null

  return (
    <article
      className={cn(
        "group relative flex min-w-0 items-start gap-3 transition-colors",
        compact ? "px-4 py-3.5" : "rounded-xl border border-border px-4 py-4",
        unread ? "bg-primary/[0.045]" : "bg-card",
        compact && "hover:bg-muted/55",
        !compact && "hover:border-foreground/15 hover:bg-muted/25"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`${notification.title} bildirimini aç`}
      />

      <span
        className={cn(
          "pointer-events-none relative mt-0.5 flex shrink-0 items-center justify-center rounded-lg",
          compact ? "size-8" : "size-9",
          severity.icon
        )}
      >
        <HugeiconsIcon icon={details.icon} className="size-4" />
      </span>

      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-5 text-foreground",
              unread ? "font-semibold" : "font-medium"
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
            "mt-1 text-xs leading-5 text-muted-foreground",
            compact ? "line-clamp-2" : "line-clamp-3"
          )}
        >
          {notification.message}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
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
          className="relative -mr-1 size-8 shrink-0 text-muted-foreground opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
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
