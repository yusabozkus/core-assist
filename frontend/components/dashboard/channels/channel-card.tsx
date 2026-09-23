import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  RefreshIcon,
  Settings02Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ConnectionStatusBadge } from "@/components/dashboard/channels/connection-status-badge"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { APP_ROUTES } from "@/constants/site"
import type { ChannelConnection, IntegrationProvider } from "@/types/channel"

export type ChannelAction =
  "disconnect" | "reconnect" | "sync" | "inventory-sync"

type ChannelCardProps = {
  connection: ChannelConnection
  provider: IntegrationProvider
  pendingAction: ChannelAction | null
  actionsDisabled: boolean
  onConfigure: (connection: ChannelConnection) => void
  onAction: (connection: ChannelConnection, action: ChannelAction) => void
  onRemove: (connection: ChannelConnection) => void
}

const channelDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function ChannelCard({
  connection,
  provider,
  pendingAction,
  actionsDisabled,
  onConfigure,
  onAction,
  onRemove,
}: ChannelCardProps) {
  const connected = connection.status === "CONNECTED"
  const canReconnect =
    connection.status === "DISCONNECTED" || connection.status === "ERROR"
  const isSyncing = Boolean(
    connection.processingStartedAt || connection.questionSyncStartedAt
  )
  const hasFailure = Boolean(
    connection.failureReason || connection.questionSyncFailureReason
  )

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex items-start gap-3.5 px-5 pt-5 sm:px-6 sm:pt-6">
        <ProviderLogo provider={provider} className="size-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {provider.name}
            </h3>
            <ConnectionStatusBadge
              status={connection.status}
              isSyncing={isSyncing}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {connection.environment === "SANDBOX"
              ? "Test ortamı"
              : "Canlı ortam"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="-mr-1 text-muted-foreground"
              aria-label={`${provider.name} bağlantı işlemleri`}
              disabled={actionsDisabled}
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {connection.status !== "PENDING" ? (
              <DropdownMenuItem onSelect={() => onConfigure(connection)}>
                <HugeiconsIcon icon={Settings02Icon} />
                Bağlantı ayarları
              </DropdownMenuItem>
            ) : null}
            {connected ? (
              <DropdownMenuItem
                onSelect={() => onAction(connection, "disconnect")}
              >
                <HugeiconsIcon icon={Unlink01Icon} />
                Devre dışı bırak
              </DropdownMenuItem>
            ) : null}
            {connection.status !== "PENDING" ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onRemove(connection)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Bağlantıyı kaldır
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="min-h-11 line-clamp-2 px-5 pt-4 text-xs leading-5 text-muted-foreground sm:px-6">
        {provider.description}
      </p>

      <dl className="mx-5 mt-5 grid grid-cols-3 gap-2 border-y border-border/80 py-4 sm:mx-6">
        {[
          { label: "Ürünler", value: connection.lastSyncAt },
          { label: "Stok", value: connection.lastInventorySyncAt },
          { label: "Sorular", value: connection.lastQuestionSyncAt },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
            <dd
              className="mt-1 truncate text-xs font-medium text-foreground tabular-nums"
              title={
                item.value
                  ? new Date(item.value).toLocaleString("tr-TR", {
                      timeZone: "Europe/Istanbul",
                    })
                  : undefined
              }
            >
              {item.value
                ? channelDateFormatter.format(new Date(item.value))
                : "Henüz yok"}
            </dd>
          </div>
        ))}
      </dl>

      {hasFailure ? (
        <div className="mx-5 mt-4 flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-xs leading-5 text-destructive sm:mx-6">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-0.5 size-4 shrink-0"
          />
          <div className="min-w-0 space-y-1">
            {connection.failureReason ? (
              <p className="line-clamp-2">
                Katalog: {connection.failureReason}
              </p>
            ) : null}
            {connection.questionSyncFailureReason ? (
              <p className="line-clamp-2">
                Sorular: {connection.questionSyncFailureReason}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {connection.status === "PENDING" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onConfigure(connection)}
              disabled={actionsDisabled}
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
              Kurulumu tamamla
            </Button>
          ) : null}
          {connected ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={
                  actionsDisabled || Boolean(connection.processingStartedAt)
                }
                onClick={() => onAction(connection, "sync")}
              >
                <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
                {pendingAction === "sync" || connection.processingStartedAt
                  ? "Güncelleniyor..."
                  : "Kataloğu güncelle"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  actionsDisabled || Boolean(connection.processingStartedAt)
                }
                onClick={() => onAction(connection, "inventory-sync")}
              >
                {pendingAction === "inventory-sync"
                  ? "Kontrol ediliyor..."
                  : "Stokları güncelle"}
              </Button>
            </>
          ) : null}
          {canReconnect ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onAction(connection, "reconnect")}
              disabled={actionsDisabled}
            >
              <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
              {pendingAction === "reconnect"
                ? "Doğrulanıyor..."
                : "Yeniden bağla"}
            </Button>
          ) : null}
        </div>
        <Link
          href={`${APP_ROUTES.dashboard.channels.sync}?provider=${encodeURIComponent(connection.providerKey)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
        >
          Geçmiş
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </Link>
      </div>
    </article>
  )
}
