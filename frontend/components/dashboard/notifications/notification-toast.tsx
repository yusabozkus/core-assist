"use client"

import { ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  NOTIFICATION_SEVERITY_STYLES,
  NOTIFICATION_TYPE_DETAILS,
} from "@/components/dashboard/notifications/notification-presentation"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/types/notification"

export function NotificationToast({
  notification,
  onOpen,
  onDismiss,
}: {
  notification: AppNotification
  onOpen: () => void
  onDismiss: () => void
}) {
  const details = NOTIFICATION_TYPE_DETAILS[notification.type]
  const severity = NOTIFICATION_SEVERITY_STYLES[notification.severity]

  return (
    <article
      className={cn(
        "relative w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-popover/95 text-popover-foreground shadow-[0_18px_55px_-22px_rgba(15,23,42,0.38)] backdrop-blur-xl",
        severity.border
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 top-0 h-0.5", severity.accent)}
      />
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-current/10 ring-inset",
            severity.icon
          )}
        >
          <HugeiconsIcon icon={details.icon} className="size-4.5" />
        </span>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${notification.title} bildirimini aç`}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            <span className={cn("size-1.5 rounded-full", severity.dot)} />
            {details.label}
          </span>
          <span className="mt-1.5 block pr-1 text-sm leading-5 font-semibold text-foreground">
            {notification.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {notification.message}
          </span>
          <span className="mt-2 flex items-center gap-1 text-[11px] font-medium text-foreground/75">
            Ayrıntıları görüntüle
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Bildirimi kapat"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </article>
  )
}
